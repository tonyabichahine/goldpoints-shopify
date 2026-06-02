import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { current_password, new_password } = await req.json()
  if (!current_password || !new_password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (new_password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('password_hash').eq('id', merchantId).single()
  if (!merchant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await bcrypt.compare(current_password, merchant.password_hash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  const password_hash = await bcrypt.hash(new_password, 10)
  await supabaseAdmin.from('merchants').update({ password_hash }).eq('id', merchantId)

  return NextResponse.json({ ok: true })
}
