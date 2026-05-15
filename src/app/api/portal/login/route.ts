import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { shop, email, password } = await req.json()
  if (!shop || !email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found.' }, { status: 404 })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('*')
    .eq('merchant_id', merchant.id)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!customer) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 })

  if (!customer.password_hash) return NextResponse.json({ error: 'No password on file. Please re-register through the store widget.' }, { status: 401 })
  const valid = await bcrypt.compare(password, customer.password_hash)
  if (!valid) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })

  const { data: history } = await supabaseAdmin
    .from('point_transactions')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ customer, history: history || [] })
}
