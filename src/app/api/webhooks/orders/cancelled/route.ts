import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, SHOPIFY_API_SECRET, tagShopifyCustomer } from '@/lib/shopify'
import { logError } from '@/lib/log'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const shop = req.headers.get('x-shopify-shop-domain') || ''
  const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
  const body = await req.text()

  const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64')
  if (hash !== hmac) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = JSON.parse(body)

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, shopify_access_token, tier_silver, tier_gold').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ ok: true })

  const { data: tx } = await supabaseAdmin
    .from('point_transactions')
    .select('id, customer_id, points')
    .eq('merchant_id', merchant.id)
    .eq('shopify_order_id', String(order.id))
    .in('type', ['earn_purchase', 'earn_order'])
    .single()

  if (!tx) return NextResponse.json({ ok: true })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, points, lifetime_points, shopify_customer_id').eq('id', tx.customer_id).single()
  if (!customer) return NextResponse.json({ ok: true })

  const newPoints = Math.max(0, customer.points - tx.points)
  const newLifetime = Math.max(0, (customer.lifetime_points ?? 0) - tx.points)
  const newTier = getTier(newLifetime, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)

  await Promise.all([
    supabaseAdmin.from('customers').update({ points: newPoints, lifetime_points: newLifetime, tier: newTier }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id,
      customer_id: customer.id,
      type: 'deduct_cancel',
      points: -tx.points,
      shopify_order_id: String(order.id),
      description: `Order #${order.order_number} cancelled`,
    }),
  ])

  if (customer.shopify_customer_id) {
    tagShopifyCustomer(merchant.shopify_access_token, shop, customer.shopify_customer_id, newTier).catch(e => logError('cancelled.tagShopifyCustomer', e))
  }

  return NextResponse.json({ ok: true })
}
