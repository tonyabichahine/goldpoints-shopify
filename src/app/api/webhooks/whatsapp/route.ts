import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = 'https://goldpoints-shopify.vercel.app'

// Meta webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Template status update from Meta
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  if (body.object !== 'whatsapp_business_account') return NextResponse.json({ ok: true })

  for (const entry of body.entry || []) {
    const wabaId = String(entry.id)

    for (const change of entry.changes || []) {
      if (change.field !== 'message_template_status_update') continue

      const { event, message_template_name, message_template_id, reason } = change.value || {}
      if (!event || !message_template_name) continue

      // Find merchant by WABA ID
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('id, email, store_name')
        .eq('whatsapp_waba_id', wabaId)
        .single()

      if (!merchant) continue

      // Update template in DB
      await supabaseAdmin
        .from('whatsapp_templates')
        .update({
          status: event,
          rejection_reason: reason || null,
          ...(message_template_id ? { meta_template_id: String(message_template_id) } : {}),
        })
        .eq('merchant_id', merchant.id)
        .eq('name', message_template_name)

      const to = process.env.TEST_EMAIL || merchant.email

      if (event === 'APPROVED') {
        await resend.emails.send({
          from: 'GoldPoints <onboarding@resend.dev>',
          to,
          subject: `✅ WhatsApp template approved: ${message_template_name}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f1a;color:#fff;border-radius:16px">
            <div style="font-size:32px;margin-bottom:12px">✅</div>
            <h2 style="margin:0 0 8px;color:#4ade80;font-size:20px">Template Approved!</h2>
            <p style="color:#d1d5db;margin:0 0 16px">Your WhatsApp template <strong style="color:#fff">${message_template_name}</strong> has been approved by Meta and is ready to use in your automation flows.</p>
            <a href="${APP_URL}/merchant?tab=flows" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Flow Builder →</a>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">GoldPoints · <a href="${APP_URL}/merchant?tab=whatsapp" style="color:#6b7280">Manage Templates</a></p>
          </div>`,
        }).catch(() => {})
      }

      if (event === 'REJECTED') {
        await resend.emails.send({
          from: 'GoldPoints <onboarding@resend.dev>',
          to,
          subject: `❌ WhatsApp template rejected: ${message_template_name}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f0f1a;color:#fff;border-radius:16px">
            <div style="font-size:32px;margin-bottom:12px">❌</div>
            <h2 style="margin:0 0 8px;color:#f87171;font-size:20px">Template Rejected</h2>
            <p style="color:#d1d5db;margin:0 0 8px">Your WhatsApp template <strong style="color:#fff">${message_template_name}</strong> was rejected by Meta.</p>
            ${reason ? `<p style="color:#fca5a5;background:#450a0a;padding:10px 14px;border-radius:8px;font-size:13px;margin:0 0 16px"><strong>Reason:</strong> ${reason}</p>` : ''}
            <p style="color:#9ca3af;font-size:13px;margin:0 0 16px">Delete the template and create a new one with adjustments.</p>
            <a href="${APP_URL}/merchant?tab=whatsapp" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Go to Templates →</a>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">GoldPoints</p>
          </div>`,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true })
}
