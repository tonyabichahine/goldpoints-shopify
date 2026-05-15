import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })

  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('*, merchants(shopify_domain, store_name)')
    .eq('email', email.toLowerCase().trim())

  if (!customers || customers.length === 0) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 })

  const matched = []
  for (const c of customers) {
    if (!c.password_hash) continue
    const valid = await bcrypt.compare(password, c.password_hash)
    if (valid) matched.push(c)
  }

  if (matched.length === 0) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })

  const stores = await Promise.all(matched.map(async (c) => {
    const { data: history } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return {
      shopify_domain: c.merchants.shopify_domain,
      store_name: c.merchants.store_name,
      customer: { id: c.id, name: c.name, email: c.email, points: c.points, tier: c.tier, created_at: c.created_at },
      history: history || [],
    }
  }))

  return NextResponse.json({ stores })
}
