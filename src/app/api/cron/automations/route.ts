import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, sendFlowEmail, buildCampaignEmailPayload } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const BATCH_SIZE = 100
const MAX_ERRORS = 3
const ENROLLMENT_LIMIT = 500
const ENROLLMENT_CONCURRENCY = 20

export const dynamic = 'force-dynamic'

function getNextNodeId(nodeId: string, edges: any[], handleId?: string): string {
  const edge = edges.find((e: any) => e.source === nodeId && (handleId ? e.sourceHandle === handleId : !e.sourceHandle || e.sourceHandle === null))
  return edge?.target || ''
}

function evaluateCondition(data: any, customer: any, enrollment?: any): boolean {
  if (data.conditionType === 'email_clicked') {
    if (!enrollment?.last_email_click_at || !enrollment?.last_email_sent_at) return false
    return enrollment.last_email_click_at > enrollment.last_email_sent_at
  }
  const fieldMap: Record<string, number | string> = {
    points: customer.points || 0,
    lifetime_points: customer.lifetime_points || 0,
    tier: customer.tier || 'Bronze',
  }
  const val = fieldMap[data.field || 'points']
  const op = data.operator || '>='
  const target = data.value || '0'
  if (typeof val === 'number') {
    const n = parseFloat(target)
    if (op === '>=') return val >= n
    if (op === '<=') return val <= n
    return val === n
  }
  return String(val) === target
}

async function processEnrollment(enrollment: any) {
  try {
    const [flowRes, customerRes, merchantRes] = await Promise.all([
      supabaseAdmin.from('automation_flows').select('nodes, edges').eq('id', enrollment.flow_id).single(),
      supabaseAdmin.from('customers').select('id, email, name, points, tier, lifetime_points, marketing_consent, whatsapp_consent, phone').eq('id', enrollment.customer_id).single(),
      supabaseAdmin.from('merchants').select('store_name, shopify_domain, email, is_premium, custom_from_email, whatsapp_credits, whatsapp_phone_number_id, whatsapp_token').eq('id', enrollment.merchant_id).single(),
    ])

    if (!flowRes.data || !customerRes.data) {
      await supabaseAdmin.from('automation_enrollments').update({ status: 'error', last_error: 'Flow or customer not found' }).eq('id', enrollment.id)
      return
    }

    const nodes: any[] = flowRes.data.nodes || []
    const edges: any[] = flowRes.data.edges || []
    const customer = { ...customerRes.data }
    const storeName = merchantRes.data?.store_name || 'Our Store'
    const shopifyDomain = merchantRes.data?.shopify_domain || ''
    const merchantEmail = merchantRes.data?.email || ''
    const customFromEmail = merchantRes.data?.is_premium && merchantRes.data?.custom_from_email ? merchantRes.data.custom_from_email : undefined
    let whatsappCredits: number = merchantRes.data?.whatsapp_credits || 0
    const whatsappPhoneNumberId: string = merchantRes.data?.whatsapp_phone_number_id || ''
    const whatsappToken: string = merchantRes.data?.whatsapp_token || ''

    const sub = (s: string) => (s || '')
      .replace(/\{\{name\}\}/g, (customer.name || customer.email).split(' ')[0])
      .replace(/\{\{points\}\}/g, String(customer.points))
      .replace(/\{\{tier\}\}/g, customer.tier)
      .replace(/\{\{store\}\}/g, storeName)

    let currentNodeId = enrollment.current_node_id

    for (let i = 0; i < 20; i++) {
      const node = nodes.find((n: any) => n.id === currentNodeId)
      if (!node) { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed', error_count: 0 }).eq('id', enrollment.id); return }
      if (node.type === 'end') { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed', error_count: 0 }).eq('id', enrollment.id); return }

      if (node.type === 'email') {
        currentNodeId = getNextNodeId(node.id, edges)
        // Advance DB position before sending — crash after this misses the send rather than duplicating it
        await supabaseAdmin.from('automation_enrollments')
          .update({ current_node_id: currentNodeId, error_count: 0 })
          .eq('id', enrollment.id)
        if (customer.marketing_consent !== false) {
          if (shopifyDomain) {
            await sendFlowEmail(customer.email, sub(node.data.subject || '(no subject)'), sub(node.data.body || ''), enrollment.id, shopifyDomain, customer.id, enrollment.merchant_id, storeName, merchantEmail, customFromEmail)
          } else {
            await sendEmail(customer.email, sub(node.data.subject || '(no subject)'), sub(node.data.body || ''))
          }
          await supabaseAdmin.from('automation_enrollments')
            .update({ last_email_sent_at: new Date().toISOString() })
            .eq('id', enrollment.id)
          enrollment.last_email_sent_at = new Date().toISOString()
          supabaseAdmin.from('flow_sends').insert({ flow_id: enrollment.flow_id, merchant_id: enrollment.merchant_id, customer_id: customer.id, channel: 'email' }).then(() => {})
        }
      } else if (node.type === 'whatsapp') {
        currentNodeId = getNextNodeId(node.id, edges)
        await supabaseAdmin.from('automation_enrollments')
          .update({ current_node_id: currentNodeId, error_count: 0 })
          .eq('id', enrollment.id)
        if (customer.whatsapp_consent !== false && customer.phone && whatsappCredits > 0 && whatsappPhoneNumberId && whatsappToken) {
          const templateName = (node.data.templateName as string) || 'goldpoints_points_earned'
          const firstName = (customer.name || customer.email).split(' ')[0]
          await sendWhatsApp(customer.phone, templateName, [firstName, storeName, String(customer.points), customer.tier], whatsappPhoneNumberId, whatsappToken)
          await supabaseAdmin.from('merchants')
            .update({ whatsapp_credits: Math.max(0, whatsappCredits - 1) })
            .eq('id', enrollment.merchant_id)
          whatsappCredits--
          supabaseAdmin.from('flow_sends').insert({ flow_id: enrollment.flow_id, merchant_id: enrollment.merchant_id, customer_id: customer.id, channel: 'whatsapp' }).then(() => {})
        }
      } else if (node.type === 'wait') {
        const ms = (node.data.unit === 'hours' ? 3600000 : 86400000) * (node.data.amount || 1)
        currentNodeId = getNextNodeId(node.id, edges)
        await supabaseAdmin.from('automation_enrollments').update({
          current_node_id: currentNodeId,
          next_run_at: new Date(Date.now() + ms).toISOString(),
          error_count: 0,
        }).eq('id', enrollment.id)
        return
      } else if (node.type === 'condition') {
        const result = evaluateCondition(node.data, customer, enrollment)
        currentNodeId = getNextNodeId(node.id, edges, result ? 'true' : 'false')
      } else if (node.type === 'addPoints') {
        const pts = node.data.points || 0
        currentNodeId = getNextNodeId(node.id, edges)
        // Advance DB position before awarding — crash after this misses the award once rather than doubling it
        await supabaseAdmin.from('automation_enrollments').update({ current_node_id: currentNodeId, error_count: 0 }).eq('id', enrollment.id)
        if (pts > 0) {
          await supabaseAdmin.from('customers').update({ points: customer.points + pts }).eq('id', customer.id)
          customer.points += pts
          await supabaseAdmin.from('point_transactions').insert({ merchant_id: enrollment.merchant_id, customer_id: customer.id, type: 'earn_flow', points: pts, description: 'Loyalty flow bonus' })
        }
      } else {
        currentNodeId = getNextNodeId(node.id, edges)
      }

      if (!currentNodeId) { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed', error_count: 0 }).eq('id', enrollment.id); return }
    }

    await supabaseAdmin.from('automation_enrollments').update({ current_node_id: currentNodeId }).eq('id', enrollment.id)
  } catch (e: any) {
    const newCount = (enrollment.error_count || 0) + 1
    await supabaseAdmin.from('automation_enrollments').update({
      error_count: newCount,
      last_error: e?.message || 'Unknown error',
      status: newCount >= MAX_ERRORS ? 'error' : 'active',
    }).eq('id', enrollment.id)
  }
}

async function enrollInactiveCustomers() {
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: flows } = await supabaseAdmin.from('automation_flows')
    .select('id, merchant_id, nodes, edges, allow_reenroll').eq('trigger', 'inactive_30').eq('active', true)
  if (!flows?.length) return

  for (const flow of flows) {
    // Exclude customers with a non-cancelled purchase in the last 30 days
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('merchant_id', flow.merchant_id)
      .not('id', 'in', `(SELECT customer_id FROM point_transactions WHERE merchant_id='${flow.merchant_id}' AND type IN ('earn_purchase','earn_order') AND created_at >= '${cutoff30}' AND (shopify_order_id IS NULL OR shopify_order_id NOT IN (SELECT shopify_order_id FROM point_transactions WHERE merchant_id='${flow.merchant_id}' AND type='deduct_cancel' AND shopify_order_id IS NOT NULL)))`)

    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')
    const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
    if (!firstEdge) continue

    for (const c of (customers || [])) {
      if (flow.allow_reenroll) {
        await supabaseAdmin.from('automation_enrollments').upsert({
          flow_id: flow.id, merchant_id: flow.merchant_id, customer_id: c.id,
          current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
        }, { onConflict: 'flow_id,customer_id' })
      } else {
        await supabaseAdmin.from('automation_enrollments').upsert({
          flow_id: flow.id, merchant_id: flow.merchant_id, customer_id: c.id,
          current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
        }, { onConflict: 'flow_id,customer_id', ignoreDuplicates: true })
      }
    }
  }
}

async function enrollBirthdayCustomers() {
  const { data: flows } = await supabaseAdmin.from('automation_flows')
    .select('id, merchant_id, nodes, edges, allow_reenroll').eq('trigger', 'birthday').eq('active', true)
  if (!flows?.length) return

  // 300-day window: prevents duplicate enrollment within the same calendar year
  const cutoff300 = new Date(Date.now() - 300 * 86400000).toISOString()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  for (const flow of flows) {
    const { data: birthdayData } = await supabaseAdmin.rpc('get_birthday_customers', { p_merchant_id: flow.merchant_id })
    const customers = (Array.isArray(birthdayData) ? birthdayData : birthdayData ? [birthdayData] : []) as { id: string }[]
    if (!customers.length) continue

    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')
    const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
    if (!firstEdge) continue

    const customerIds = customers.map(c => c.id)

    // Load existing enrollments to guard against hourly re-enrollment
    const { data: existing } = await supabaseAdmin
      .from('automation_enrollments')
      .select('customer_id, enrolled_at')
      .eq('flow_id', flow.id)
      .in('customer_id', customerIds)

    const enrolledAtMap: Record<string, string> = {}
    for (const e of existing || []) {
      if (e.enrolled_at) enrolledAtMap[e.customer_id] = e.enrolled_at
    }

    // Fetch merchant birthday_bonus once per flow
    const { data: merchant } = await supabaseAdmin
      .from('merchants').select('birthday_bonus').eq('id', flow.merchant_id).single()
    const birthdayBonus = merchant?.birthday_bonus || 0

    for (const c of customers) {
      // Skip if enrolled within the last 300 days (already got birthday this year)
      const lastEnrolled = enrolledAtMap[c.id]
      if (lastEnrolled && lastEnrolled > cutoff300) continue

      // Award birthday bonus points once per day if configured
      if (birthdayBonus > 0) {
        const { data: alreadyAwarded } = await supabaseAdmin
          .from('point_transactions')
          .select('id').eq('merchant_id', flow.merchant_id).eq('customer_id', c.id)
          .eq('type', 'earn_birthday').gte('created_at', todayStart.toISOString()).limit(1)

        if (!alreadyAwarded?.length) {
          const { data: cust } = await supabaseAdmin.from('customers').select('points').eq('id', c.id).single()
          if (cust) {
            await supabaseAdmin.from('customers').update({ points: cust.points + birthdayBonus }).eq('id', c.id)
            await supabaseAdmin.from('point_transactions').insert({
              merchant_id: flow.merchant_id, customer_id: c.id,
              type: 'earn_birthday', points: birthdayBonus, description: 'Birthday bonus',
            })
          }
        }
      }

      await supabaseAdmin.from('automation_enrollments').upsert({
        flow_id: flow.id, merchant_id: flow.merchant_id, customer_id: c.id,
        current_node_id: firstEdge.target, next_run_at: new Date().toISOString(),
        status: 'active', enrolled_at: new Date().toISOString(),
      }, { onConflict: 'flow_id,customer_id' })
    }
  }
}

async function processPendingCampaignSends() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: pending } = await supabaseAdmin
    .from('campaign_sends')
    .select('id, campaign_id, merchant_id, customer_id')
    .is('sent_at', null)
    .lt('created_at', cutoff)
    .limit(500)
  if (!pending?.length) return

  const byCampaign: Record<string, typeof pending> = {}
  for (const s of pending) {
    if (!byCampaign[s.campaign_id]) byCampaign[s.campaign_id] = []
    byCampaign[s.campaign_id].push(s)
  }

  for (const [campaignId, sends] of Object.entries(byCampaign)) {
    const [campaignRes, merchantRes] = await Promise.all([
      supabaseAdmin.from('campaigns').select('subject, body').eq('id', campaignId).single(),
      supabaseAdmin.from('merchants').select('store_name, shopify_domain, email, is_premium, custom_from_email').eq('id', sends[0].merchant_id).single(),
    ])
    if (!campaignRes.data) continue

    const storeName = merchantRes.data?.store_name || 'Our Store'
    const shopifyDomain = merchantRes.data?.shopify_domain || ''
    const merchantEmail = merchantRes.data?.email || ''
    const customFromEmail = merchantRes.data?.is_premium && merchantRes.data?.custom_from_email ? merchantRes.data.custom_from_email : undefined
    const customerIds = sends.map(s => s.customer_id)
    const { data: customers } = await supabaseAdmin.from('customers')
      .select('id, email, name, points, tier, marketing_consent').in('id', customerIds)
    if (!customers?.length) continue

    const customerMap = Object.fromEntries(
      (customers.filter((c: any) => c.marketing_consent !== false)).map(c => [c.id, c])
    )

    for (let i = 0; i < sends.length; i += BATCH_SIZE) {
      const batch = sends.slice(i, i + BATCH_SIZE)
      const emails = batch.flatMap(s => {
        const c = customerMap[s.customer_id]
        if (!c) return []
        const firstName = (c.name || c.email).split(' ')[0]
        const sub = (str: string) => str
          .replace(/\{\{name\}\}/g, firstName).replace(/\{\{points\}\}/g, String(c.points))
          .replace(/\{\{tier\}\}/g, c.tier).replace(/\{\{store\}\}/g, storeName)
        return [buildCampaignEmailPayload(c.email, sub(campaignRes.data!.subject), sub(campaignRes.data!.body), campaignId, c.id, shopifyDomain, sends[0].merchant_id, storeName, merchantEmail, customFromEmail)]
      })
      if (!emails.length) continue
      try {
        await resend.batch.send(emails)
        await supabaseAdmin.from('campaign_sends').update({ sent_at: new Date().toISOString() })
          .in('id', batch.map(s => s.id))
      } catch {}
    }
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (process.env.VERCEL === '1' && secret) {
    const headerAuth = req.headers.get('authorization') === `Bearer ${secret}`
    const queryAuth = new URL(req.url).searchParams.get('secret') === secret
    if (!headerAuth && !queryAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await enrollInactiveCustomers().catch(() => {})
  await enrollBirthdayCustomers().catch(() => {})
  await processPendingCampaignSends().catch(() => {})

  const { data: enrollments } = await supabaseAdmin
    .from('automation_enrollments')
    .select('id, flow_id, customer_id, merchant_id, current_node_id, last_email_click_at, last_email_sent_at, error_count')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(ENROLLMENT_LIMIT)

  if (!enrollments?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (let i = 0; i < enrollments.length; i += ENROLLMENT_CONCURRENCY) {
    const chunk = enrollments.slice(i, i + ENROLLMENT_CONCURRENCY)
    await Promise.allSettled(chunk.map(e => processEnrollment(e)))
    processed += chunk.length
  }

  return NextResponse.json({ processed })
}
