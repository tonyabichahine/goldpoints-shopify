import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ ok: true }) // silent — no enumeration

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, store_name, email').eq('email', email.toLowerCase().trim()).single()
  if (!merchant) return NextResponse.json({ ok: true })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabaseAdmin.from('merchants').update({ reset_token: token, reset_token_expires: expires }).eq('id', merchant.id)

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-merchant-password?token=${token}`

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GoldPoints <onboarding@resend.dev>',
    to: process.env.TEST_EMAIL || merchant.email,
    subject: 'Reset your GoldPoints dashboard password',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0f0f1a;color:#e0e0f0;padding:40px;border-radius:16px">
        <div style="font-size:24px;font-weight:800;margin-bottom:24px">
          <span style="color:#a78bfa">Gold</span><span style="color:#fbbf24">Points</span>
        </div>
        <p style="font-size:16px;margin-bottom:8px">Hi ${merchant.store_name},</p>
        <p style="color:#c0c0d8;line-height:1.6;margin-bottom:24px">We received a request to reset your GoldPoints dashboard password. Click below to set a new one.</p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-bottom:24px">Reset Password →</a>
        <p style="color:#8080a0;font-size:12px;line-height:1.6">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
