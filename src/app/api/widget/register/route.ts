import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email, name, phone, birthday } = await req.json()
  if (!shop || !email || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, signup_bonus').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const existing = await supabaseAdmin
    .from('customers').select('id, points, tier').eq('merchant_id', merchant.id).eq('email', email).single()

  if (existing.data) {
    return NextResponse.json({ customer: existing.data, alreadyRegistered: true }, { headers: cors })
  }

  const bonus = merchant.signup_bonus || 0
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .insert({ merchant_id: merchant.id, email, name, phone: phone || null, birthday: birthday || null, points: bonus, tier: 'Bronze' })
    .select().single()

  if (error) return NextResponse.json({ error: 'Registration failed' }, { status: 500, headers: cors })

  if (bonus > 0) {
    await supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchant.id, customer_id: customer.id,
      type: 'earn_signup', points: bonus, description: 'Welcome bonus',
    })
  }

  return NextResponse.json({ customer, alreadyRegistered: false }, { headers: cors })
}
