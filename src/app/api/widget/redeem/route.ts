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
    .from('merchants').select('id, shopify_access_token').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const [{ data: customer }, { data: offer }] = await Promise.all([
    supabaseAdmin.from('customers').select('id, points').eq('merchant_id', merchant.id).eq('email', email).single(),
    supabaseAdmin.from('offers').select('*').eq('id', offerId).eq('merchant_id', merchant.id).single(),
  ])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: cors })
  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: cors })
  if (customer.points < offer.points_required) return NextResponse.json({ error: 'Not enough points' }, { status: 400, headers: cors })

  const code = `GP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const discountCode = await createDiscountCode(shop, merchant.shopify_access_token, code, offer.offer_type, offer.offer_value)

  const newPoints = customer.points - offer.points_required
  await Promise.all([
    supabaseAdmin.from('customers').update({ points: newPoints, tier: getTier(newPoints) }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      type: 'redeem', points: -offer.points_required, description: `Redeemed: ${offer.name}`,
    }),
    supabaseAdmin.from('redemptions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      offer_id: offer.id, discount_code: discountCode || code, points_spent: offer.points_required,
    }),
  ])

  return NextResponse.json({ discountCode: discountCode || code, newPoints }, { headers: cors })
}
