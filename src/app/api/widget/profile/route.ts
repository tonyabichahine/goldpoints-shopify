import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email, name, birthday, marketing_consent } = await req.json()
  if (!shop || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, signup_bonus').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: existing } = await supabaseAdmin
    .from('customers').select('*').eq('merchant_id', merchant.id).eq('email', email.toLowerCase().trim()).single()

  if (existing) {
    const { data: updated } = await supabaseAdmin
      .from('customers')
      .update({ birthday: birthday || null, marketing_consent: !!marketing_consent, name: name || existing.name })
      .eq('id', existing.id)
      .select().single()
    return NextResponse.json({ customer: updated, isNew: false }, { headers: cors })
  }

  const bonus = merchant.signup_bonus || 0
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .insert({ merchant_id: merchant.id, email: email.toLowerCase().trim(), name: name || email, birthday: birthday || null, marketing_consent: !!marketing_consent, points: bonus, tier: 'Bronze' })
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
