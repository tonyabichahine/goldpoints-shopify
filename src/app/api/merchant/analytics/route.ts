import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalCustomers },
    { data: txAll },
    { count: totalRedemptions },
    { data: txRecent },
    { data: topCustomers },
    { data: newCustomers },
    { data: allCustomers },
    { data: allRedemptions },
    { data: campaignAttribs },
  ] = await Promise.all([
    supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type, created_at').eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('redemptions').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type, description, created_at, customers(name, email)').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('customers').select('name, email, points, tier').eq('merchant_id', merchantId).order('points', { ascending: false }).limit(5),
    supabaseAdmin.from('customers').select('created_at').eq('merchant_id', merchantId).gte('created_at', since14),
    supabaseAdmin.from('customers').select('points, tier').eq('merchant_id', merchantId),
    supabaseAdmin.from('redemptions').select('offer_id, offers(name)').eq('merchant_id', merchantId),
    supabaseAdmin.from('campaign_attributions').select('revenue').eq('merchant_id', merchantId).gte('created_at', since30),
  ])

  const totalPointsIssued = (txAll || []).filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
  const totalPointsRedeemed = Math.abs((txAll || []).filter(t => t.points < 0 && t.type === 'redeem').reduce((s, t) => s + t.points, 0))

  // Points liability — total unredeemed points across all customers
  const totalPointsLiability = (allCustomers || []).reduce((s, c) => s + (c.points || 0), 0)

  // Tier breakdown
  const tierBreakdown = { Bronze: 0, Silver: 0, Gold: 0 }
  for (const c of allCustomers || []) {
    if (c.tier in tierBreakdown) tierBreakdown[c.tier as keyof typeof tierBreakdown]++
  }

  // Offer performance (all-time, sorted by redemption count)
  const offerMap: Record<string, { name: string; count: number }> = {}
  for (const r of allRedemptions || []) {
    const id = r.offer_id as string
    const name = (Array.isArray(r.offers) ? (r.offers[0] as any) : r.offers as any)?.name || 'Unknown'
    if (!offerMap[id]) offerMap[id] = { name, count: 0 }
    offerMap[id].count++
  }
  const totalOfferRedemptions = Object.values(offerMap).reduce((s, o) => s + o.count, 0)
  const offerPerformance = Object.entries(offerMap)
    .map(([id, { name, count }]) => ({ id, name, count, pct: totalOfferRedemptions > 0 ? Math.round(count / totalOfferRedemptions * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  // 14-day bar charts
  const pointsByDay: Record<string, number> = {}
  const signupsByDay: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    pointsByDay[key] = 0
    signupsByDay[key] = 0
  }
  ;(txAll || []).filter(t => t.points > 0).forEach(t => {
    const key = t.created_at.slice(0, 10)
    if (key in pointsByDay) pointsByDay[key] += t.points
  })
  ;(newCustomers || []).forEach(c => {
    const key = (c.created_at as string).slice(0, 10)
    if (key in signupsByDay) signupsByDay[key] += 1
  })

  const pointsChart = Object.entries(pointsByDay).map(([date, value]) => ({ date: date.slice(5), value }))
  const signupsChart = Object.entries(signupsByDay).map(([date, value]) => ({ date: date.slice(5), value }))

  const campaignRevenue = (campaignAttribs || []).reduce((s, a) => s + (parseFloat(a.revenue) || 0), 0)
  const campaignOrders = (campaignAttribs || []).length

  return NextResponse.json({
    totalCustomers: totalCustomers || 0,
    totalPointsIssued,
    totalPointsRedeemed,
    totalRedemptions: totalRedemptions || 0,
    totalPointsLiability,
    campaignRevenue,
    campaignOrders,
    tierBreakdown,
    offerPerformance,
    pointsChart,
    signupsChart,
    topCustomers: topCustomers || [],
    recentActivity: (txRecent || []).map(t => ({
      ...t,
      customerName: (Array.isArray(t.customers) ? t.customers[0] : t.customers as { name: string; email: string } | null)?.name || 'Unknown',
    })),
  })
}
