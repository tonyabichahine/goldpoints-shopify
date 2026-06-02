import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('merchant_id', merchantId)

  if (!customers?.length) return NextResponse.json({ total: 0, segments: {} })

  // Get cancelled order IDs so we can exclude them from "last purchase"
  const { data: cancels } = await supabaseAdmin
    .from('point_transactions')
    .select('shopify_order_id')
    .eq('merchant_id', merchantId)
    .eq('type', 'deduct_cancel')
    .not('shopify_order_id', 'is', null)

  const cancelledIds = new Set((cancels || []).map((c: any) => c.shopify_order_id).filter(Boolean))

  // Get last real (non-cancelled) earn_order per customer
  const { data: txData } = await supabaseAdmin
    .from('point_transactions')
    .select('customer_id, created_at, shopify_order_id')
    .eq('merchant_id', merchantId)
    .in('type', ['earn_order', 'earn_purchase'])
    .order('created_at', { ascending: false })
    .limit(5000)

  const lastPurchase: Record<string, number> = {}
  for (const tx of txData || []) {
    if (tx.shopify_order_id && cancelledIds.has(tx.shopify_order_id)) continue
    if (!(tx.customer_id in lastPurchase)) {
      lastPurchase[tx.customer_id] = new Date(tx.created_at).getTime()
    }
  }

  const now = Date.now()
  const counts = { active: 0, atRisk: 0, dormant: 0, lapsing: 0, lost: 0, never: 0 }

  for (const c of customers) {
    const last = lastPurchase[c.id]
    if (!last) { counts.never++; continue }
    const days = (now - last) / 86400000
    if (days <= 30) counts.active++
    else if (days <= 60) counts.atRisk++
    else if (days <= 90) counts.dormant++
    else if (days <= 180) counts.lapsing++
    else counts.lost++
  }

  const total = customers.length

  return NextResponse.json({
    total,
    segments: {
      active:   { count: counts.active,   pct: Math.round(counts.active   / total * 100), label: 'Active',           days: '≤ 30 days',    color: '#4ade80' },
      atRisk:   { count: counts.atRisk,   pct: Math.round(counts.atRisk   / total * 100), label: 'At Risk',          days: '31–60 days',   color: '#facc15' },
      dormant:  { count: counts.dormant,  pct: Math.round(counts.dormant  / total * 100), label: 'Dormant',          days: '61–90 days',   color: '#fb923c' },
      lapsing:  { count: counts.lapsing,  pct: Math.round(counts.lapsing  / total * 100), label: 'Lapsing',          days: '91–180 days',  color: '#f87171' },
      lost:     { count: counts.lost,     pct: Math.round(counts.lost     / total * 100), label: 'Lost',             days: '180+ days',    color: '#6b7280' },
      never:    { count: counts.never,    pct: Math.round(counts.never    / total * 100), label: 'Never Purchased',  days: 'No purchase',  color: '#a78bfa' },
    }
  })
}
