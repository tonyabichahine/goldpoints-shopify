import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, buildUpgradeBonusData, SHOPIFY_API_SECRET } from '@/lib/shopify'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const shop = req.headers.get('x-shopify-shop-domain') || ''
  const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
  const body = await req.text()

  const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64')
  if (hash !== hmac) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = JSON.parse(body)
  const customerEmail = order.email
  if (!customerEmail) return NextResponse.json({ ok: true })

  const { data: merchant } = await supabaseAdmin
    .from('merchants')
    .select('id, points_per_dollar, tier_silver, tier_gold, tier_bronze_multiplier, tier_silver_multiplier, tier_gold_multiplier, tier_silver_bonus, tier_gold_bonus')
    .eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ ok: true })

  const orderTotal = parseFloat(order.total_price || '0')
  const basePoints = Math.floor(orderTotal * merchant.points_per_dollar)
  if (basePoints <= 0) return NextResponse.json({ ok: true })

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, points, tier, lifetime_points, silver_bonus_awarded, gold_bonus_awarded')
    .eq('merchant_id', merchant.id).eq('email', customerEmail).single()
  if (!customer) return NextResponse.json({ ok: true })

  const multiplierMap: Record<string, number> = {
    Bronze: merchant.tier_bronze_multiplier ?? 1.0,
    Silver: merchant.tier_silver_multiplier ?? 1.5,
    Gold:   merchant.tier_gold_multiplier   ?? 2.0,
  }
  const multiplier = multiplierMap[customer.tier] ?? 1.0
  const pointsEarned = Math.floor(basePoints * multiplier)

  const newLifetime = (customer.lifetime_points ?? 0) + pointsEarned
  const newTier = getTier(newLifetime, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)

  const { extraPoints, customerUpdates: bonusUpdates, transactions: bonusTxs } = buildUpgradeBonusData(
    merchant.id, customer.id, customer.tier, newTier,
    merchant.tier_silver_bonus ?? 0, merchant.tier_gold_bonus ?? 0,
    customer.silver_bonus_awarded ?? false, customer.gold_bonus_awarded ?? false,
  )

  await Promise.all([
    supabaseAdmin.from('customers').update({
      points: customer.points + pointsEarned + extraPoints,
      lifetime_points: newLifetime + extraPoints,
      tier: newTier,
      ...bonusUpdates,
    }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert([
      {
        merchant_id: merchant.id, customer_id: customer.id,
        type: 'earn_purchase', points: pointsEarned,
        shopify_order_id: String(order.id),
        description: `Order #${order.order_number} — $${orderTotal}${multiplier !== 1 ? ` (${multiplier}× ${customer.tier})` : ''}`,
      },
      ...bonusTxs,
    ]),
  ])

  return NextResponse.json({ ok: true })
}
