import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

function getMerchantId(req: NextRequest) {
  return verifyMerchantToken(req.cookies.get('merchant_session')?.value)
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: campaigns } = await supabaseAdmin.from('campaigns').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false })
  if (!campaigns?.length) return NextResponse.json([])

  const campaignIds = campaigns.map(c => c.id)
  const [{ data: attributions }, { data: clicks }, { data: opens }] = await Promise.all([
    supabaseAdmin.from('campaign_attributions').select('campaign_id, revenue').eq('merchant_id', merchantId).in('campaign_id', campaignIds),
    supabaseAdmin.from('campaign_clicks').select('campaign_id').in('campaign_id', campaignIds),
    supabaseAdmin.from('campaign_sends').select('campaign_id').in('campaign_id', campaignIds).not('opened_at', 'is', null),
  ])

  const attrMap: Record<string, { orders: number; revenue: number }> = {}
  for (const a of attributions || []) {
    if (!attrMap[a.campaign_id]) attrMap[a.campaign_id] = { orders: 0, revenue: 0 }
    attrMap[a.campaign_id].orders++
    attrMap[a.campaign_id].revenue += parseFloat(a.revenue) || 0
  }
  const clickMap: Record<string, number> = {}
  for (const cl of clicks || []) {
    clickMap[cl.campaign_id] = (clickMap[cl.campaign_id] || 0) + 1
  }
  const openMap: Record<string, number> = {}
  for (const o of opens || []) {
    openMap[o.campaign_id] = (openMap[o.campaign_id] || 0) + 1
  }

  return NextResponse.json(campaigns.map(c => {
    const attributed_revenue = attrMap[c.id]?.revenue || 0
    const attributed_orders = attrMap[c.id]?.orders || 0
    const link_clicks = clickMap[c.id] || 0
    const open_count = openMap[c.id] || 0
    const open_rate = c.recipient_count > 0 ? parseFloat(((open_count / c.recipient_count) * 100).toFixed(1)) : 0
    const revenue_per_email = c.recipient_count > 0
      ? parseFloat((attributed_revenue / c.recipient_count).toFixed(2))
      : 0
    return { ...c, attributed_orders, attributed_revenue, revenue_per_email, link_clicks, open_count, open_rate }
  }))
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('campaigns').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
