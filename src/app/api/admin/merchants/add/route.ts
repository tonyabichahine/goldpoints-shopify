import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  // Send welcome email
  await resend.emails.send({
    from: 'GoldPoints <onboarding@resend.dev>',
    to: email,
    subject: 'Welcome to GoldPoints — Your Account is Ready',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0f0f1a;color:#e0e0f0;padding:40px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:4px">
          <span style="color:#a78bfa">Gold</span><span style="color:#fbbf24">Points</span>
        </div>
        <p style="color:#8080a0;margin-top:4px;margin-bottom:32px">Loyalty rewards for Shopify merchants</p>

        <p style="font-size:16px;margin-bottom:24px">Hi ${store_name},</p>
        <p style="color:#c0c0d8;line-height:1.6">Your GoldPoints account has been created. Here are your login details:</p>

        <div style="background:#16162a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:24px 0">
          <div style="margin-bottom:12px">
            <span style="color:#8080a0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Email</span>
            <div style="font-weight:600;margin-top:4px">${email}</div>
          </div>
          <div>
            <span style="color:#8080a0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Password</span>
            <div style="font-weight:600;margin-top:4px;font-family:monospace;font-size:18px;color:#a78bfa">${password}</div>
          </div>
        </div>

        <p style="color:#e74c3c;font-size:13px;margin-bottom:24px">⚠️ Please change your password after your first login.</p>

        <a href="https://goldpoints-shopify.vercel.app" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">Log In to Dashboard →</a>

        <p style="color:#8080a0;font-size:12px;margin-top:32px;line-height:1.6">Once logged in, connect your Shopify store to activate the loyalty widget on your storefront.<br/>Need help? Reply to this email.</p>
      </div>
    `,
  })

  return NextResponse.json(data)
}
