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

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
