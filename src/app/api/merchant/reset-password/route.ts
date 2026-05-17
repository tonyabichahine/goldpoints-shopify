import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password || password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, reset_token_expires').eq('reset_token', token).single()

  if (!merchant) return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 })

  if (!merchant.reset_token_expires || new Date(merchant.reset_token_expires as string) < new Date())
    return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 10)
  await supabaseAdmin.from('merchants')
    .update({ password_hash, reset_token: null, reset_token_expires: null })
    .eq('id', merchant.id)

  return NextResponse.json({ ok: true })
}
