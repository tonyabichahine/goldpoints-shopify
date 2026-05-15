import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, SHOPIFY_API_SECRET } from '@/lib/shopify'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const shop = req.headers.get('x-shopify-shop-domain') || ''
  const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
  const body = await req.text()

  // Verify webhook signature
  const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64')
  if (hash !== hmac) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = JSON.parse(body)
  const customerEmail = order.email
  if (!customerEmail) return NextResponse.json({ ok: true })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, points_per_dollar').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ ok: true })

  const orderTotal = parseFloat(order.total_price || '0')
  const pointsEarned = Math.floor(orderTotal * merchant.points_per_dollar)
  if (pointsEarned <= 0) return NextResponse.json({ ok: true })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, points').eq('merchant_id', merchant.id).eq('email', customerEmail).single()
  if (!customer) return NextResponse.json({ ok: true })

  const newPoints = customer.points + pointsEarned
  const newTier = getTier(newPoints)

  await Promise.all([
    supabaseAdmin.from('customers').update({ points: newPoints, tier: newTier }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id,
      customer_id: customer.id,
      type: 'earn_purchase',
      points: pointsEarned,
      shopify_order_id: String(order.id),
      description: `Order #${order.order_number} — $${orderTotal}`,
    }),
  ])

  return NextResponse.json({ ok: true })
}
