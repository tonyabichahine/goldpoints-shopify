import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function pick(row: any) {
  const r = Array.isArray(row) ? row[0] : row
  return r ?? {}
}

function sinceFromPeriod(period: string | null) {
  if (!period || period === 'all') return null
  const days = parseInt(period)
  if (!days) return null
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function GET(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type')
  const since = sinceFromPeriod(req.nextUrl.searchParams.get('period') || '30')
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  if (type === 'points') {
    let q = supabaseAdmin
      .from('point_transactions')
      .select('points, type, description, created_at, customers(name, email)')
      .eq('merchant_id', merchantId)
      .gt('points', 0)
      .order('created_at', { ascending: false })
      .limit(100)
    if (since) q = q.gte('created_at', since)
    const { data } = await q
    return NextResponse.json((data || []).map(t => ({
      points: t.points, type: t.type, description: t.description, created_at: t.created_at,
      customerName: pick(t.customers).name || 'Unknown',
      customerEmail: pick(t.customers).email || '',
    })))
  }

  if (type === 'redemptions') {
    let q = supabaseAdmin
      .from('redemptions')
      .select('discount_code, created_at, customers(name, email), offers(name, points_required, offer_type, offer_value)')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (since) q = q.gte('created_at', since)
    const { data } = await q
    return NextResponse.json((data || []).map(r => ({
      discount_code: r.discount_code, created_at: r.created_at,
      customerName: pick(r.customers).name || 'Unknown',
      customerEmail: pick(r.customers).email || '',
      offerName: pick(r.offers).name || 'Unknown offer',
      offerType: pick(r.offers).offer_type || '',
      offerValue: pick(r.offers).offer_value || '',
      pointsRequired: pick(r.offers).points_required || 0,
    })))
  }

  if (type === 'signups') {
    const signupSince = since ?? since14
    let q = supabaseAdmin
      .from('customers')
      .select('name, email, tier, points, created_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (signupSince) q = q.gte('created_at', signupSince)
    const { data } = await q
    return NextResponse.json(data || [])
  }

  if (type === 'activity') {
    let q = supabaseAdmin
      .from('point_transactions')
      .select('points, type, description, created_at, customers(name, email)')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (since) q = q.gte('created_at', since)
    const { data } = await q
    return NextResponse.json((data || []).map(t => ({
      points: t.points, type: t.type, description: t.description, created_at: t.created_at,
      customerName: pick(t.customers).name || 'Unknown',
      customerEmail: pick(t.customers).email || '',
    })))
  }

  if (type === 'segment') {
    const segment = req.nextUrl.searchParams.get('segment')
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, name, email, points, tier, created_at')
      .eq('merchant_id', merchantId)
    const { data: txData } = await supabaseAdmin
      .from('point_transactions')
      .select('customer_id, created_at')
      .eq('merchant_id', merchantId)
      .in('type', ['earn_order', 'earn_purchase'])
      .order('created_at', { ascending: false })
      .limit(5000)
    const lastPurchase: Record<string, string> = {}
    for (const tx of txData || []) {
      if (!(tx.customer_id in lastPurchase)) lastPurchase[tx.customer_id] = tx.created_at
    }
    const now = Date.now()
    const result = (customers || []).filter(c => {
      const last = lastPurchase[c.id]
      if (!last) return segment === 'never'
      const days = (now - new Date(last).getTime()) / 86400000
      if (segment === 'active')  return days <= 30
      if (segment === 'atRisk')  return days > 30  && days <= 60
      if (segment === 'dormant') return days > 60  && days <= 90
      if (segment === 'lapsing') return days > 90  && days <= 180
      if (segment === 'lost')    return days > 180
      return false
    }).map(c => ({
      ...c,
      lastPurchase: lastPurchase[c.id] || null,
      daysSince: lastPurchase[c.id] ? Math.floor((now - new Date(lastPurchase[c.id]).getTime()) / 86400000) : null,
    })).sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
