import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants')
    .select('id, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!merchant || !merchant.password_hash)
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  const valid = await bcrypt.compare(password, merchant.password_hash)
  if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('merchant_session', merchant.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
  return res
}
