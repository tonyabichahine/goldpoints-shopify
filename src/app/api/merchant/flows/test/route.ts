import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, sendFlowEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

function getNextNodeId(nodeId: string, edges: any[], handleId?: string): string {
  const edge = edges.find((e: any) => e.source === nodeId && (handleId ? e.sourceHandle === handleId : !e.sourceHandle || e.sourceHandle === null))
  return edge?.target || ''
}

function evaluateCondition(data: any, customer: any): boolean {
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

export async function POST(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { flow_id, customer_email } = await req.json()
  if (!flow_id || !customer_email) return NextResponse.json({ error: 'Missing flow_id or customer_email' }, { status: 400 })

  const [flowRes, customerRes, merchantRes] = await Promise.all([
    supabaseAdmin.from('automation_flows').select('nodes, edges, name').eq('id', flow_id).eq('merchant_id', merchantId).single(),
    supabaseAdmin.from('customers').select('id, email, name, points, tier, lifetime_points, marketing_consent, whatsapp_consent, phone').eq('merchant_id', merchantId).eq('email', customer_email).single(),
    supabaseAdmin.from('merchants').select('store_name, shopify_domain, email, is_premium, custom_from_email, whatsapp_credits, whatsapp_phone_number_id, whatsapp_token').eq('id', merchantId).single(),
  ])

  if (!flowRes.data) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })
  if (!customerRes.data) return NextResponse.json({ error: `No customer found with email ${customer_email}` }, { status: 404 })

  const nodes: any[] = flowRes.data.nodes || []
  const edges: any[] = flowRes.data.edges || []
  const customer = customerRes.data
  const merchant = merchantRes.data
  const storeName = merchant?.store_name || 'Our Store'
  const shopifyDomain = merchant?.shopify_domain || ''
  const merchantEmail = merchant?.email || ''
  const customFromEmail = merchant?.is_premium && merchant?.custom_from_email ? merchant.custom_from_email : undefined
  const whatsappPhoneNumberId: string = merchant?.whatsapp_phone_number_id || ''
  const whatsappToken: string = merchant?.whatsapp_token || ''

  const sub = (s: string) => (s || '')
    .replace(/\{\{name\}\}/g, (customer.name || customer.email).split(' ')[0])
    .replace(/\{\{points\}\}/g, String(customer.points))
    .replace(/\{\{tier\}\}/g, customer.tier)
    .replace(/\{\{store\}\}/g, storeName)

  const triggerNode = nodes.find((n: any) => n.type === 'trigger')
  const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
  if (!firstEdge) return NextResponse.json({ error: 'Flow has no steps after the trigger' }, { status: 400 })

  const log: string[] = []
  let currentNodeId = firstEdge.target

  for (let i = 0; i < 20; i++) {
    const node = nodes.find((n: any) => n.id === currentNodeId)
    if (!node) { log.push('✓ Flow completed'); break }
    if (node.type === 'end') { log.push('✓ Reached end node'); break }

    if (node.type === 'email') {
      if (customer.marketing_consent === false) {
        log.push('⚠ Email skipped — customer has no marketing consent')
      } else {
        try {
          if (shopifyDomain) {
            await sendFlowEmail(customer.email, sub(node.data.subject || '(no subject)'), sub(node.data.body || ''), 'test', shopifyDomain, customer.id, merchantId, storeName, merchantEmail, customFromEmail)
          } else {
            await sendEmail(customer.email, sub(node.data.subject || '(no subject)'), sub(node.data.body || ''))
          }
          log.push(`✉️ Email sent to ${customer.email} — "${sub(node.data.subject || '(no subject)')}"`)
        } catch (e: any) {
          log.push(`✗ Email failed: ${e?.message}`)
        }
      }
      currentNodeId = getNextNodeId(node.id, edges)
    } else if (node.type === 'whatsapp') {
      if (!customer.phone) {
        log.push('⚠ WhatsApp skipped — customer has no phone number')
      } else if (customer.whatsapp_consent === false) {
        log.push('⚠ WhatsApp skipped — customer has no WhatsApp consent')
      } else if (!whatsappPhoneNumberId || !whatsappToken) {
        log.push('⚠ WhatsApp skipped — WhatsApp not configured for this store')
      } else {
        try {
          const templateName = (node.data.templateName as string) || 'goldpoints_points_earned'
          const firstName = (customer.name || customer.email).split(' ')[0]
          await sendWhatsApp(customer.phone, templateName, [firstName, storeName, String(customer.points), customer.tier], whatsappPhoneNumberId, whatsappToken)
          log.push(`💬 WhatsApp sent to ${customer.phone} — template: ${templateName}`)
        } catch (e: any) {
          log.push(`✗ WhatsApp failed: ${e?.message}`)
        }
      }
      currentNodeId = getNextNodeId(node.id, edges)
    } else if (node.type === 'wait') {
      const amount = node.data.amount || 1
      const unit = node.data.unit === 'hours' ? 'hour(s)' : 'day(s)'
      log.push(`⏸ Wait node: would pause ${amount} ${unit} (skipped in test)`)
      currentNodeId = getNextNodeId(node.id, edges)
    } else if (node.type === 'condition') {
      const result = evaluateCondition(node.data, customer)
      log.push(`🔀 Condition: ${node.data.field} ${node.data.operator} ${node.data.value} → ${result ? 'YES' : 'NO'}`)
      currentNodeId = getNextNodeId(node.id, edges, result ? 'true' : 'false')
    } else if (node.type === 'addPoints') {
      log.push(`⭐ Add Points node: would award ${node.data.points || 0} pts (skipped in test)`)
      currentNodeId = getNextNodeId(node.id, edges)
    } else {
      currentNodeId = getNextNodeId(node.id, edges)
    }

    if (!currentNodeId) { log.push('✓ Flow completed'); break }
  }

  return NextResponse.json({ ok: true, log })
}
