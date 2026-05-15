import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { shop, email, birthday } = await req.json()
  if (!shop || !email || !birthday) return NextResponse.json({ error: 'Email and birthday are required.' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found.' }, { status: 404 })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('*')
    .eq('merchant_id', merchant.id)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!customer) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 })

  // Verify birthday matches
  if (!customer.birthday) return NextResponse.json({ error: 'No birthday on file. Please use the store widget to update your profile.' }, { status: 401 })
  if (customer.birthday !== birthday) return NextResponse.json({ error: 'Birthday does not match our records.' }, { status: 401 })

  const { data: history } = await supabaseAdmin
    .from('point_transactions')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ customer, history: history || [] })
}
