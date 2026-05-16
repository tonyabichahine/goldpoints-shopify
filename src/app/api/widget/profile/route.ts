import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

function genCode() {
  return Math.random().toString(36).substring(2, 8)
}

export async function POST(req: NextRequest) {
  const { shop, email, name, birthday, marketing_consent, gp_ref, password } = await req.json()
  if (!shop || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, signup_bonus, referral_points').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: existing } = await supabaseAdmin
    .from('customers').select('*').eq('merchant_id', merchant.id).eq('email', email.toLowerCase().trim()).single()

  if (existing) {
    const updates: Record<string, unknown> = { birthday: birthday || null, marketing_consent: !!marketing_consent, name: name || existing.name }
    if (!existing.referral_code) updates.referral_code = genCode()
    if (password && !existing.password_hash) updates.password_hash = await bcrypt.hash(password, 10)
    const { data: updated } = await supabaseAdmin.from('customers').update(updates).eq('id', existing.id).select().single()
    return NextResponse.json({ customer: updated, isNew: false }, { headers: cors })
  }

  const bonus = merchant.signup_bonus || 0
  const referral_code = genCode()
  const password_hash = password ? await bcrypt.hash(password, 10) : null

  // Check if referred by someone
  let referred_by = null
  if (gp_ref) {
    const { data: referrer } = await supabaseAdmin
      .from('customers').select('id, points').eq('referral_code', gp_ref).eq('merchant_id', merchant.id).single()
    if (referrer) {
      referred_by = referrer.id
      const refPts = merchant.referral_points || 100
      await supabaseAdmin.from('customers').update({ points: referrer.points + refPts }).eq('id', referrer.id)
      await supabaseAdmin.from('point_transactions').insert({
        merchant_id: merchant.id, customer_id: referrer.id,
        type: 'earn_referral', points: refPts, description: `Referral bonus: ${email} joined`,
      })
    }
  }

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .insert({ merchant_id: merchant.id, email: email.toLowerCase().trim(), name: name || email, birthday: birthday || null, marketing_consent: !!marketing_consent, password_hash, points: bonus, tier: 'Bronze', referral_code, referred_by })
    .select().single()

  if (error) return NextResponse.json({ error: 'Failed to save profile' }, { status: 500, headers: cors })

  if (bonus > 0) {
    await supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      type: 'earn_signup', points: bonus, description: 'Welcome bonus',
    })
  }

  return NextResponse.json({ customer, isNew: true }, { headers: cors })
}
