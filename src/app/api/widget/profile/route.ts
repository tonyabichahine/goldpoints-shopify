import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, buildUpgradeBonusData } from '@/lib/shopify'
import { fireAutomation, enrollInFlows } from '@/lib/email'
import { sendWhatsAppPoints } from '@/lib/whatsapp'
import { checkRateLimit } from '@/lib/ratelimit'
import bcrypt from 'bcryptjs'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

function genCode() {
  return Math.random().toString(36).substring(2, 8)
}

export async function POST(req: NextRequest) {
  const { limited } = await checkRateLimit(req, 10, 60)
  if (limited) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429, headers: cors })

  const { shop, email, name, birthday, marketing_consent, whatsapp_consent, phone, gp_ref, password } = await req.json()
  if (!shop || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, store_name, signup_bonus, referral_points, tier_silver, tier_gold, tier_silver_bonus, tier_gold_bonus, whatsapp_auto_notify').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: existing } = await supabaseAdmin
    .from('customers').select('*').eq('merchant_id', merchant.id).eq('email', email.toLowerCase().trim()).single()

  if (existing) {
    const updates: Record<string, unknown> = { birthday: birthday || null, marketing_consent: !!marketing_consent, name: name || existing.name, whatsapp_consent: !!whatsapp_consent }
    if (phone) updates.phone = phone
    if (!existing.referral_code) updates.referral_code = genCode()
    if (password && !existing.password_hash) updates.password_hash = await bcrypt.hash(password, 10)
    const { data: updated } = await supabaseAdmin.from('customers').update(updates).eq('id', existing.id).select().single()
    return NextResponse.json({ customer: updated, isNew: false }, { headers: cors })
  }

  const bonus = merchant.signup_bonus || 0
  const referral_code = genCode()
  const password_hash = password ? await bcrypt.hash(password, 10) : null

  // Referral: credit the referrer
  let referred_by = null
  if (gp_ref) {
    const { data: referrer } = await supabaseAdmin
      .from('customers').select('id, points, tier, lifetime_points, silver_bonus_awarded, gold_bonus_awarded').eq('referral_code', gp_ref).eq('merchant_id', merchant.id).single()
    if (referrer) {
      referred_by = referrer.id
      const refPts = merchant.referral_points || 100
      const refNewLifetime = (referrer.lifetime_points ?? 0) + refPts
      const refNewTier = getTier(refNewLifetime, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)
      const { extraPoints: refExtra, customerUpdates: refBonusUpdates, transactions: refBonusTxs } = buildUpgradeBonusData(
        merchant.id, referrer.id, referrer.tier, refNewTier,
        merchant.tier_silver_bonus ?? 0, merchant.tier_gold_bonus ?? 0,
        referrer.silver_bonus_awarded ?? false, referrer.gold_bonus_awarded ?? false,
      )
      await Promise.all([
        supabaseAdmin.from('customers').update({
          points: referrer.points + refPts + refExtra,
          lifetime_points: refNewLifetime + refExtra,
          tier: refNewTier,
          ...refBonusUpdates,
        }).eq('id', referrer.id),
        supabaseAdmin.from('point_transactions').insert([
          { merchant_id: merchant.id, customer_id: referrer.id, type: 'earn_referral', points: refPts, description: `Referral bonus: ${email} joined` },
          ...refBonusTxs,
        ]),
      ])
    }
  }

  // New customer: tier based on signup bonus
  const initialTier = getTier(bonus, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .insert({ merchant_id: merchant.id, email: email.toLowerCase().trim(), name: name || email, birthday: birthday || null, marketing_consent: !!marketing_consent, whatsapp_consent: !!whatsapp_consent, phone: phone || null, password_hash, points: bonus, lifetime_points: bonus, tier: initialTier, referral_code, referred_by })
    .select().single()

  if (error) return NextResponse.json({ error: 'Failed to save profile' }, { status: 500, headers: cors })

  const txsToInsert: Array<Record<string, unknown>> = []
  if (bonus > 0) {
    txsToInsert.push({ merchant_id: merchant.id, customer_id: customer.id, type: 'earn_signup', points: bonus, description: 'Welcome bonus' })
  }

  // Check if signup bonus triggers a tier upgrade bonus
  const { extraPoints, customerUpdates: bonusUpdates, transactions: bonusTxs } = buildUpgradeBonusData(
    merchant.id, customer.id, 'Bronze', initialTier,
    merchant.tier_silver_bonus ?? 0, merchant.tier_gold_bonus ?? 0,
    false, false,
  )
  if (extraPoints > 0) {
    await supabaseAdmin.from('customers').update({ points: bonus + extraPoints, lifetime_points: bonus + extraPoints, ...bonusUpdates }).eq('id', customer.id)
    txsToInsert.push(...bonusTxs)
  }

  if (txsToInsert.length > 0) {
    await supabaseAdmin.from('point_transactions').insert(txsToInsert)
  }

  fireAutomation(merchant.id, 'signup', { email: email.toLowerCase().trim(), name: name || email, points: customer.points, tier: customer.tier }, merchant.store_name || '').catch(() => {})
  enrollInFlows(merchant.id, customer.id, 'signup').catch(() => {})
  if (merchant.whatsapp_auto_notify && whatsapp_consent && phone) {
    sendWhatsAppPoints(merchant.id, phone, name || email, customer.points, merchant.store_name || '').catch(() => {})
  }

  return NextResponse.json({ customer, isNew: true }, { headers: cors })
}
