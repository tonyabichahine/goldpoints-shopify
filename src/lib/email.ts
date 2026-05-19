import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(to: string, subject: string, htmlBody: string) {
  const recipient = process.env.TEST_EMAIL || to
  try {
    await resend.emails.send({
      from: 'GoldPoints <onboarding@resend.dev>',
      to: recipient,
      subject,
      html: wrapEmail(htmlBody),
    })
  } catch {}
}

function wrapEmail(body: string) {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f0f5;margin:0;padding:24px}
    .wrap{max-width:560px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden;color:#e0e0f0}
    .hdr{background:linear-gradient(135deg,#6c3fff,#4c2fff);padding:24px 32px;text-align:center}
    .hdr h1{color:#fff;margin:0;font-size:1.3rem;font-weight:800}
    .bdy{padding:28px 32px;line-height:1.65;font-size:.95rem;color:#d0d0e8}
    .ftr{padding:16px 32px;background:#0f0f1a;font-size:.75rem;color:#4b5563;text-align:center}
  </style></head>
  <body><div class="wrap">
    <div class="hdr"><h1>⭐ GoldPoints</h1></div>
    <div class="bdy">${escaped}</div>
    <div class="ftr">You're receiving this as a loyalty member of this store.</div>
  </div></body></html>`
}

export async function fireAutomation(
  merchantId: string,
  trigger: string,
  customer: { email: string; name: string; points: number; tier: string },
  storeName: string,
) {
  const { data: automation } = await supabaseAdmin
    .from('automations')
    .select('id, subject, body')
    .eq('merchant_id', merchantId)
    .eq('trigger', trigger)
    .eq('active', true)
    .maybeSingle()

  if (!automation) return

  const firstName = (customer.name || customer.email).split(' ')[0]
  const sub = (s: string) => s
    .replace(/\{\{name\}\}/g, firstName)
    .replace(/\{\{points\}\}/g, String(customer.points))
    .replace(/\{\{tier\}\}/g, customer.tier)
    .replace(/\{\{store\}\}/g, storeName)

  await sendEmail(customer.email, sub(automation.subject), sub(automation.body))
}
