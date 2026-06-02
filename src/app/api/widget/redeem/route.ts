import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createDiscountCode, getTier } from '@/lib/shopify'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email, offerId } = await req.json()
  if (!shop || !email || !offerId) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, shopify_access_token, tier_silver, tier_gold').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const [{ data: customer }, { data: offer }] = await Promise.all([
    supabaseAdmin.from('customers').select('id, points, lifetime_points, tier').eq('merchant_id', merchant.id).eq('email', email).single(),
    supabaseAdmin.from('offers').select('*').eq('id', offerId).eq('merchant_id', merchant.id).single(),
  ])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: cors })
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: cors })

  // Tier lock: enforce the offer's minimum tier server-side (the widget hides
  // locked offers, but a direct API call could bypass that).
  const tierRank: Record<string, number> = { Bronze: 0, Silver: 1, Gold: 2 }
  if (offer.min_tier && (tierRank[customer.tier] ?? 0) < (tierRank[offer.min_tier] ?? 0)) {
    return NextResponse.json({ error: `This reward requires ${offer.min_tier} tier` }, { status: 403, headers: cors })
  }

  if (customer.points < offer.points_required) return NextResponse.json({ error: 'Not enough points' }, { status: 400, headers: cors })

  // Atomic deduction: decrements only if the customer still has enough points,
  // which prevents two concurrent redemptions from both succeeding (double-spend).
  // Returns the new balance, or null if the points were no longer available.
  const { data: newPoints, error: deductErr } = await supabaseAdmin
    .rpc('redeem_points', { p_customer_id: customer.id, p_amount: offer.points_required })
  if (deductErr || newPoints === null) {
    return NextResponse.json({ error: 'Not enough points' }, { status: 400, headers: cors })
  }

  // Create the discount code only after points are safely deducted.
  const code = `GP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  let discountCode: string | null = null
  try {
    discountCode = await createDiscountCode(shop, merchant.shopify_access_token, code, offer.offer_type, offer.offer_value)
  } catch { discountCode = null }

  // If the code couldn't be created, refund the points so the customer isn't charged for nothing.
  if (!discountCode) {
    await supabaseAdmin.rpc('redeem_points', { p_customer_id: customer.id, p_amount: -offer.points_required })
    return NextResponse.json({ error: 'Could not generate your code. Please try again.' }, { status: 502, headers: cors })
  }

  // Tier based on lifetime_points — redemptions never drop tier
  const newTier = getTier(customer.lifetime_points ?? 0, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)

  await Promise.all([
    supabaseAdmin.from('customers').update({ tier: newTier }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      type: 'redeem', points: -offer.points_required, description: `Redeemed: ${offer.name}`,
    }),
    supabaseAdmin.from('redemptions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      offer_id: offer.id, discount_code: discountCode, points_spent: offer.points_required,
    }),
  ])

  return NextResponse.json({ discountCode, newPoints }, { headers: cors })
}
