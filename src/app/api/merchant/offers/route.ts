import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function getMerchantId(req: NextRequest) {
  return verifyMerchantToken(req.cookies.get('merchant_session')?.value)
}

export async function GET(req: NextRequest) {
  const merchantId = await getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await supabaseAdmin.from('offers').select('*').eq('merchant_id', merchantId).order('points_required')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const merchantId = await getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('offers')
    .insert({ merchant_id: merchantId, name: body.name, description: body.description, points_required: body.points_required, offer_type: body.offer_type, offer_value: body.offer_value, min_tier: body.min_tier || 'Bronze' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const merchantId = await getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('offers').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
