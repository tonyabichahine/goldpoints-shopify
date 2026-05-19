import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

const resend = new Resend(process.env.RESEND_API_KEY)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints-shopify.vercel.app'

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

export async function sendCampaignEmail(
  to: string, subject: string, body: string,
  campaignId: string, customerId: string, shopifyDomain: string,
) {
  const recipient = process.env.TEST_EMAIL || to
  const storeUrl = shopifyDomain ? `https://${shopifyDomain}` : ''
  const trackedCta = storeUrl
    ? `\n\n<a href="${BASE_URL}/api/track/click?cid=${campaignId}&uid=${customerId}&url=${encodeURIComponent(storeUrl)}" style="display:inline-block;background:#6c3fff;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.9rem;margin-top:8px">Shop Now →</a>`
    : ''
  try {
    await resend.emails.send({
      from: 'GoldPoints <onboarding@resend.dev>',
      to: recipient,
      subject,
      html: wrapEmail(body + trackedCta),
    })
  } catch {}
}

function wrapEmail(body: string) {
  const escaped = body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    // restore the tracked CTA link we added (it's already HTML)
    .replace(/&lt;a href=/g, '<a href=').replace(/&lt;\/a&gt;/g, '</a>')
    .replace(/"style="display:inline-block;background:#6c3fff;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.9rem;margin-top:8px"&gt;(.*?)&lt;\/a&gt;/g, '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
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
    <div class="ftr">You're receiving this as a loyalty member of this store.</div>
  </div></body></html>`
}

export async function sendCampaignEmailHtml(
  to: string, subject: string, body: string,
  campaignId: string, customerId: string, shopifyDomain: string,
) {
  const recipient = process.env.TEST_EMAIL || to
  const storeUrl = shopifyDomain ? `https://${shopifyDomain}` : ''
  const trackedBtn = storeUrl
    ? `<div style="text-align:center;margin-top:24px"><a href="${BASE_URL}/api/track/click?cid=${campaignId}&uid=${customerId}&url=${encodeURIComponent(storeUrl)}" style="display:inline-block;background:#6c3fff;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:.9rem">Shop Now →</a></div>`
    : ''
  const escaped = body
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
    <div class="bdy">${escaped}${trackedBtn}</div>
    <div class="ftr">You're receiving this as a loyalty member of this store.</div>
  </div></body></html>`
  try {
    await resend.emails.send({ from: 'GoldPoints <onboarding@resend.dev>', to: recipient, subject, html })
  } catch {}
}

// enrollInFlows: supports comma-separated trigger field and multiple trigger nodes per flow
export async function enrollInFlows(merchantId: string, customerId: string, trigger: string) {
  const { data: flows } = await supabaseAdmin
    .from('automation_flows')
    .select('id, nodes, edges, allow_reenroll')
    .eq('merchant_id', merchantId)
    .eq('active', true)
    .ilike('trigger', `%${trigger}%`)
  if (!flows?.length) return

  for (const flow of flows) {
    const nodes: any[] = flow.nodes || []
    const edges: any[] = flow.edges || []
    // Find all trigger nodes matching this event
    const matchingTriggers = nodes.filter((n: any) => n.type === 'trigger' && n.data?.triggerType === trigger)
    for (const triggerNode of matchingTriggers) {
      const firstEdge = edges.find((e: any) => e.source === triggerNode.id)
      if (!firstEdge) continue
      if (flow.allow_reenroll) {
        // Re-enrollment: upsert and reset to active regardless of prior completion
        await supabaseAdmin.from('automation_enrollments').upsert({
          flow_id: flow.id, merchant_id: merchantId, customer_id: customerId,
          current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
        }, { onConflict: 'flow_id,customer_id' })
      } else {
        await supabaseAdmin.from('automation_enrollments').upsert({
          flow_id: flow.id, merchant_id: merchantId, customer_id: customerId,
          current_node_id: firstEdge.target, next_run_at: new Date().toISOString(), status: 'active',
        }, { onConflict: 'flow_id,customer_id', ignoreDuplicates: true })
      }
    }
  }
}

export async function fireAutomation(
  merchantId: string, trigger: string,
  customer: { email: string; name: string; points: number; tier: string },
  storeName: string,
) {
  const { data: automation } = await supabaseAdmin
    .from('automations').select('id, subject, body')
    .eq('merchant_id', merchantId).eq('trigger', trigger).eq('active', true).maybeSingle()
  if (!automation) return
  const firstName = (customer.name || customer.email).split(' ')[0]
  const sub = (s: string) => s
    .replace(/\{\{name\}\}/g, firstName).replace(/\{\{points\}\}/g, String(customer.points))
    .replace(/\{\{tier\}\}/g, customer.tier).replace(/\{\{store\}\}/g, storeName)
  await sendEmail(customer.email, sub(automation.subject), sub(automation.body))
}
