import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, buildUpgradeBonusData } from '@/lib/shopify'
import { fireAutomation, enrollInFlows } from '@/lib/email'
import { checkRateLimit } from '@/lib/ratelimit'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { limited } = await checkRateLimit(req, 10, 60)
  if (limited) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429, headers: cors })

  const { shop, email } = await req.json()
  if (!shop || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, store_name, follow_points, tier_silver, tier_gold, tier_silver_bonus, tier_gold_bonus').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, points, tier, lifetime_points, silver_bonus_awarded, gold_bonus_awarded, name').eq('merchant_id', merchant.id).eq('email', email).single()
  if (!customer) return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: cors })

  const { data: existing } = await supabaseAdmin
    .from('point_transactions').select('id').eq('customer_id', customer.id).eq('type', 'earn_follow').single()
  if (existing) return NextResponse.json({ error: 'You have already claimed your follow reward.' }, { status: 400, headers: cors })

  const pts = merchant.follow_points || 50
  const newLifetime = (customer.lifetime_points ?? 0) + pts
  const newTier = getTier(newLifetime, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)

  const { extraPoints, customerUpdates: bonusUpdates, transactions: bonusTxs } = buildUpgradeBonusData(
    merchant.id, customer.id, customer.tier, newTier,
    merchant.tier_silver_bonus ?? 0, merchant.tier_gold_bonus ?? 0,
    customer.silver_bonus_awarded ?? false, customer.gold_bonus_awarded ?? false,
  )

  const newPoints = customer.points + pts + extraPoints

  await Promise.all([
    supabaseAdmin.from('customers').update({ points: newPoints, lifetime_points: newLifetime + extraPoints, tier: newTier, ...bonusUpdates }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert([
      { merchant_id: merchant.id, customer_id: customer.id, type: 'earn_follow', points: pts, description: 'Followed on social media' },
      ...bonusTxs,
    ]),
  ])

  if (newTier !== customer.tier) {
    const trigger = newTier === 'Gold' ? 'tier_gold' : 'tier_silver'
    fireAutomation(merchant.id, trigger, { email, name: customer.name || email, points: newPoints, tier: newTier }, merchant.store_name).catch(() => {})
    enrollInFlows(merchant.id, customer.id, trigger).catch(() => {})
  }

  return NextResponse.json({ newPoints, pointsEarned: pts }, { headers: cors })
}
