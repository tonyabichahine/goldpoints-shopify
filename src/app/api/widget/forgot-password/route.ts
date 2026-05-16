import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'
import { Resend } from 'resend'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
const resend = new Resend(process.env.RESEND_API_KEY)

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email } = await req.json()
  if (!shop || !email) return NextResponse.json({ ok: true }, { headers: cors }) // silent — no enumeration

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, store_name').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ ok: true }, { headers: cors })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, email, name')
    .eq('merchant_id', merchant.id).eq('email', email.toLowerCase().trim()).single()
  if (!customer) return NextResponse.json({ ok: true }, { headers: cors })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  await supabaseAdmin.from('customers').update({ reset_token: token, reset_token_expires: expires }).eq('id', customer.id)

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}&shop=${encodeURIComponent(shop)}`

  await resend.emails.send({
    from: 'GoldPoints <onboarding@resend.dev>',
    to: process.env.TEST_EMAIL || customer.email,
    subject: `Reset your ${merchant.store_name} loyalty password`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0f0f1a;color:#e0e0f0;padding:40px;border-radius:16px">
        <div style="font-size:24px;font-weight:800;margin-bottom:24px">
          <span style="color:#a78bfa">Gold</span><span style="color:#fbbf24">Points</span>
        </div>
        <p style="font-size:16px;margin-bottom:8px">Hi ${customer.name || customer.email},</p>
        <p style="color:#c0c0d8;line-height:1.6;margin-bottom:24px">We received a request to reset your loyalty account password for <strong>${merchant.store_name}</strong>. Click the button below to set a new password.</p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-bottom:24px">Reset Password →</a>
        <p style="color:#8080a0;font-size:12px;line-height:1.6">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email — your account is safe.</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true }, { headers: cors })
}
