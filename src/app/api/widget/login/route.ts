import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email, password } = await req.json()
  if (!shop || !email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found.' }, { status: 404, headers: cors })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('*')
    .eq('merchant_id', merchant.id)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!customer) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404, headers: cors })
  if (!customer.password_hash) return NextResponse.json({ error: 'No password set. Please register first.' }, { status: 401, headers: cors })

  const valid = await bcrypt.compare(password, customer.password_hash)
  if (!valid) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401, headers: cors })

  return NextResponse.json({ customer }, { headers: cors })
}
