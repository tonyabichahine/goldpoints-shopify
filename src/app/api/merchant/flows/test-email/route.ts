import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { subject, body, to } = await req.json()

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('email, store_name').eq('id', merchantId).single()

  const recipient = process.env.TEST_EMAIL || to || merchant?.email
  if (!recipient) return NextResponse.json({ error: 'No recipient email' }, { status: 400 })

  const storeName = merchant?.store_name || 'Your Store'
  const sub = (s: string) => (s || '')
    .replace(/\{\{name\}\}/g, 'Alex')
    .replace(/\{\{points\}\}/g, '420')
    .replace(/\{\{tier\}\}/g, 'Silver')
    .replace(/\{\{store\}\}/g, storeName)

  const escaped = sub(body || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f5;margin:0;padding:24px}
    .wrap{max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden;color:#e0e0f0}
    .hdr{background:linear-gradient(135deg,#6c3fff,#4c2fff);padding:24px 32px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:1.3rem;font-weight:800}
    .bdy{padding:28px 32px;line-height:1.65;font-size:.95rem;color:#d0d0e8}
    .ftr{padding:16px 32px;background:#0f0f1a;font-size:.75rem;color:#4b5563;text-align:center}
    a{color:#a78bfa}
  </style></head>
  <body><div class="wrap">
    <div class="hdr"><h1>⭐ GoldPoints</h1></div>
    <div class="bdy">${escaped}</div>
    <div class="ftr">This is a test email — sample data: name=Alex, points=420, tier=Silver.</div>
  </div></body></html>`

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'GoldPoints <onboarding@resend.dev>',
      to: recipient,
      subject: `[TEST] ${sub(subject) || '(no subject)'}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
