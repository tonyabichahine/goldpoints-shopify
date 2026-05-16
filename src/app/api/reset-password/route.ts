import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password || password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, reset_token_expires, merchants(shopify_domain)')
    .eq('reset_token', token).single()

  if (!customer) return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })

  const expires = customer.reset_token_expires as string
  if (!expires || new Date(expires) < new Date())
    return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 10)
  await supabaseAdmin.from('customers')
    .update({ password_hash, reset_token: null, reset_token_expires: null })
    .eq('id', customer.id)

  const m = (Array.isArray(customer.merchants) ? customer.merchants[0] : customer.merchants) as { shopify_domain: string }
  return NextResponse.json({ ok: true, shop: m?.shopify_domain || null })
}
