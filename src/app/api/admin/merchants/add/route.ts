import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const pw = req.cookies.get('admin_session')?.value
  if (pw !== (process.env.ADMIN_PASSWORD || 'admin123')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopify_domain, store_name, email, password } = await req.json()
  if (!store_name || !email || !password) return NextResponse.json({ error: 'Store name, email, and password are required.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 10)
  const domain = shopify_domain ? (shopify_domain.includes('.') ? shopify_domain : `${shopify_domain}.myshopify.com`) : null

  const { data, error } = await supabaseAdmin
    .from('merchants')
    .insert({ shopify_domain: domain, store_name, email: email.toLowerCase().trim(), password_hash, shopify_access_token: 'pending' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
