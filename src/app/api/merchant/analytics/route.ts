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
  ] = await Promise.all([
    supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type, created_at').eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('redemptions').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type, description, created_at, customers(name, email)').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(8),
    supabaseAdmin.from('customers').select('name, email, points, tier').eq('merchant_id', merchantId).order('points', { ascending: false }).limit(5),
    supabaseAdmin.from('customers').select('created_at').eq('merchant_id', merchantId).gte('created_at', since14),
  ])

  // Points issued (positive transactions only) last 30 days
  const totalPointsIssued = (txAll || []).filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
  const totalPointsRedeemed = Math.abs((txAll || []).filter(t => t.points < 0 && t.type === 'redeem').reduce((s, t) => s + t.points, 0))

  // Build 14-day bar chart data for points earned per day
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

  return NextResponse.json({
    totalCustomers: totalCustomers || 0,
    totalPointsIssued,
    totalPointsRedeemed,
    totalRedemptions: totalRedemptions || 0,
    pointsChart,
    signupsChart,
    topCustomers: topCustomers || [],
    recentActivity: (txRecent || []).map(t => ({
      ...t,
      customerName: (Array.isArray(t.customers) ? t.customers[0] : t.customers as { name: string; email: string } | null)?.name || 'Unknown',
    })),
  })
}
