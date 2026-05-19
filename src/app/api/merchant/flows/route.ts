import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  const analytics = req.nextUrl.searchParams.get('analytics')
  if (id) {
    const { data } = await supabaseAdmin.from('automation_flows').select('*').eq('id', id).eq('merchant_id', merchantId).single()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (analytics) {
      const { data: enrollments } = await supabaseAdmin
        .from('automation_enrollments').select('status').eq('flow_id', id)
      const total = enrollments?.length || 0
      const active = enrollments?.filter(e => e.status === 'active').length || 0
      const completed = enrollments?.filter(e => e.status === 'completed').length || 0
      return NextResponse.json({ ...data, analytics: { total, active, completed } })
    }
    return NextResponse.json(data)
  }
  const { data: flowList } = await supabaseAdmin
    .from('automation_flows')
    .select('id, name, trigger, active, allow_reenroll, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
  if (!flowList?.length) return NextResponse.json([])

  const { data: enrollments } = await supabaseAdmin
    .from('automation_enrollments')
    .select('flow_id, status')
    .in('flow_id', flowList.map(f => f.id))

  const enrollMap: Record<string, { total: number; active: number; completed: number }> = {}
  for (const e of enrollments || []) {
    if (!enrollMap[e.flow_id]) enrollMap[e.flow_id] = { total: 0, active: 0, completed: 0 }
    enrollMap[e.flow_id].total++
    if (e.status === 'active') enrollMap[e.flow_id].active++
    if (e.status === 'completed') enrollMap[e.flow_id].completed++
  }

  return NextResponse.json(flowList.map(f => ({
    ...f,
    enrolled: enrollMap[f.id]?.total || 0,
    active_enrollments: enrollMap[f.id]?.active || 0,
    completed_enrollments: enrollMap[f.id]?.completed || 0,
  })))
}

export async function POST(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json()
  const trigger = body.trigger || 'signup'
  const { data, error } = await supabaseAdmin.from('automation_flows')
    .insert({
      merchant_id: merchantId,
      name: body.name || 'New Flow',
      trigger,
      active: body.active ?? false,
      allow_reenroll: body.allow_reenroll ?? false,
      nodes: body.nodes ?? [{ id: 'trigger-1', type: 'trigger', position: { x: 200, y: 80 }, data: { triggerType: trigger || 'signup' } }],
      edges: body.edges ?? [],
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.trigger !== undefined) updates.trigger = body.trigger
  if (body.active !== undefined) updates.active = body.active
  if (body.allow_reenroll !== undefined) updates.allow_reenroll = body.allow_reenroll
  if (body.nodes !== undefined) updates.nodes = body.nodes
  if (body.edges !== undefined) updates.edges = body.edges
  const { error } = await supabaseAdmin.from('automation_flows').update(updates).eq('id', body.id).eq('merchant_id', merchantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('automation_flows').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
