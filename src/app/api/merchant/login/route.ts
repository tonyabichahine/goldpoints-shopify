import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/ratelimit'
import { signMerchantSession, SESSION_COOKIE_OPTS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { limited } = await checkRateLimit(req)
  if (limited) return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })

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
  res.cookies.set('merchant_session', signMerchantSession(merchant.id), SESSION_COOKIE_OPTS)
  return res
}
