import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

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

async function processEnrollment(enrollment: any) {
  const [flowRes, customerRes, merchantRes] = await Promise.all([
    supabaseAdmin.from('automation_flows').select('nodes, edges').eq('id', enrollment.flow_id).single(),
    supabaseAdmin.from('customers').select('id, email, name, points, tier, lifetime_points').eq('id', enrollment.customer_id).single(),
    supabaseAdmin.from('merchants').select('store_name').eq('id', enrollment.merchant_id).single(),
  ])

  if (!flowRes.data || !customerRes.data) {
    await supabaseAdmin.from('automation_enrollments').update({ status: 'error' }).eq('id', enrollment.id)
    return
  }

  const nodes: any[] = flowRes.data.nodes || []
  const edges: any[] = flowRes.data.edges || []
  const customer = { ...customerRes.data }
  const storeName = merchantRes.data?.store_name || 'Our Store'

  const sub = (s: string) => (s || '')
    .replace(/\{\{name\}\}/g, (customer.name || customer.email).split(' ')[0])
    .replace(/\{\{points\}\}/g, String(customer.points))
    .replace(/\{\{tier\}\}/g, customer.tier)
    .replace(/\{\{store\}\}/g, storeName)

  let currentNodeId = enrollment.current_node_id

  for (let i = 0; i < 20; i++) {
    const node = nodes.find((n: any) => n.id === currentNodeId)
    if (!node) { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed' }).eq('id', enrollment.id); return }
    if (node.type === 'end') { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed' }).eq('id', enrollment.id); return }

    if (node.type === 'email') {
      await sendEmail(customer.email, sub(node.data.subject || '(no subject)'), sub(node.data.body || ''))
      currentNodeId = getNextNodeId(node.id, edges)
    } else if (node.type === 'wait') {
      const ms = (node.data.unit === 'hours' ? 3600000 : 86400000) * (node.data.amount || 1)
      currentNodeId = getNextNodeId(node.id, edges)
      await supabaseAdmin.from('automation_enrollments').update({
        current_node_id: currentNodeId,
        next_run_at: new Date(Date.now() + ms).toISOString(),
      }).eq('id', enrollment.id)
      return
    } else if (node.type === 'condition') {
      const result = evaluateCondition(node.data, customer)
      currentNodeId = getNextNodeId(node.id, edges, result ? 'true' : 'false')
    } else if (node.type === 'addPoints') {
      const pts = node.data.points || 0
      await supabaseAdmin.from('customers').update({ points: customer.points + pts }).eq('id', customer.id)
      customer.points += pts
      await supabaseAdmin.from('point_transactions').insert({ merchant_id: enrollment.merchant_id, customer_id: customer.id, type: 'earn_flow', points: pts, description: 'Loyalty flow bonus' })
      currentNodeId = getNextNodeId(node.id, edges)
    } else {
      currentNodeId = getNextNodeId(node.id, edges)
    }

    if (!currentNodeId) { await supabaseAdmin.from('automation_enrollments').update({ status: 'completed' }).eq('id', enrollment.id); return }
  }

  await supabaseAdmin.from('automation_enrollments').update({ current_node_id: currentNodeId }).eq('id', enrollment.id)
}

async function enrollInactiveCustomers() {
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const cutoff31 = new Date(Date.now() - 31 * 86400000).toISOString()

  const { data: flows } = await supabaseAdmin.from('automation_flows').select('id, merchant_id, nodes, edges').eq('trigger', 'inactive_30').eq('active', true)
  if (!flows?.length) return

  for (const flow of flows) {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('merchant_id', flow.merchant_id)
      .not('id', 'in', `(SELECT customer_id FROM point_transactions WHERE merchant_id='${flow.merchant_id}' AND type IN ('earn_purchase','earn_order') AND created_at >= '${cutoff30}')`)

    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')
    const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
    if (!firstEdge) continue

    for (const c of (customers || [])) {
      await supabaseAdmin.from('automation_enrollments').upsert({
        flow_id: flow.id, merchant_id: flow.merchant_id, customer_id: c.id,
        current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
      }, { onConflict: 'flow_id,customer_id', ignoreDuplicates: true })
    }
  }
}

async function enrollBirthdayCustomers() {
  const { data: flows } = await supabaseAdmin.from('automation_flows').select('id, merchant_id, nodes, edges').eq('trigger', 'birthday').eq('active', true)
  if (!flows?.length) return

  for (const flow of flows) {
    const { data: birthdayData } = await supabaseAdmin.rpc('get_birthday_customers', { p_merchant_id: flow.merchant_id }).select('id')
    const customers = (Array.isArray(birthdayData) ? birthdayData : birthdayData ? [birthdayData] : []) as { id: string }[]
    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    const triggerNode = nodes.find((n: any) => n.type === 'trigger')
    const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
    if (!firstEdge) continue
    for (const c of customers) {
      await supabaseAdmin.from('automation_enrollments').upsert({
        flow_id: flow.id, merchant_id: flow.merchant_id, customer_id: c.id,
        current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
      }, { onConflict: 'flow_id,customer_id', ignoreDuplicates: true })
    }
  }
}

export async function GET(req: NextRequest) {
  if (process.env.VERCEL === '1' && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await enrollInactiveCustomers().catch(() => {})
  await enrollBirthdayCustomers().catch(() => {})

  const { data: enrollments } = await supabaseAdmin
    .from('automation_enrollments')
    .select('id, flow_id, customer_id, merchant_id, current_node_id')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(100)

  if (!enrollments?.length) return NextResponse.json({ processed: 0 })

  let processed = 0
  for (const e of enrollments) {
    await processEnrollment(e).catch(() => {})
    processed++
  }

  return NextResponse.json({ processed })
}
