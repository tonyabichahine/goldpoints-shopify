import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const shop = req.cookies.get('merchant_shop')?.value
  if (!shop) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data } = await supabaseAdmin.from('offers').select('*').eq('merchant_id', merchant.id).order('points_required')
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const shop = req.cookies.get('merchant_shop')?.value
  if (!shop) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('offers')
    .insert({ merchant_id: merchant.id, name: body.name, description: body.description, points_required: body.points_required, offer_type: body.offer_type, offer_value: body.offer_value })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const shop = req.cookies.get('merchant_shop')?.value
  if (!shop) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('offers').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
