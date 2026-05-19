import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await supabaseAdmin.from('automations').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('automations')
    .insert({ merchant_id: merchantId, trigger: body.trigger, name: body.name, subject: body.subject, body: body.body, active: true })
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
  if (body.active !== undefined) updates.active = body.active
  if (body.subject !== undefined) updates.subject = body.subject
  if (body.body !== undefined) updates.body = body.body
  if (body.name !== undefined) updates.name = body.name
  const { error } = await supabaseAdmin.from('automations').update(updates).eq('id', body.id).eq('merchant_id', merchantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('automations').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
