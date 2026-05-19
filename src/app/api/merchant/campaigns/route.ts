import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: campaigns } = await supabaseAdmin.from('campaigns').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false })
  if (!campaigns?.length) return NextResponse.json([])

  const { data: attributions } = await supabaseAdmin
    .from('campaign_attributions')
    .select('campaign_id, revenue')
    .eq('merchant_id', merchantId)
    .in('campaign_id', campaigns.map(c => c.id))

  const attrMap: Record<string, { orders: number; revenue: number }> = {}
  for (const a of attributions || []) {
    if (!attrMap[a.campaign_id]) attrMap[a.campaign_id] = { orders: 0, revenue: 0 }
    attrMap[a.campaign_id].orders++
    attrMap[a.campaign_id].revenue += parseFloat(a.revenue) || 0
  }

  return NextResponse.json(campaigns.map(c => ({
    ...c,
    attributed_orders: attrMap[c.id]?.orders || 0,
    attributed_revenue: attrMap[c.id]?.revenue || 0,
  })))
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('campaigns').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
