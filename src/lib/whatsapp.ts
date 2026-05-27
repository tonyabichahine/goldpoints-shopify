import { supabaseAdmin } from './supabase'

export async function sendWhatsAppPoints(
  merchantId: string,
  customerPhone: string,
  customerName: string,
  points: number,
  storeName: string
) {
  if (!customerPhone) return
  try {
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('whatsapp_token, whatsapp_phone_number_id')
      .eq('id', merchantId)
      .single()
    if (!merchant?.whatsapp_token || !merchant?.whatsapp_phone_number_id) return

    const { data: template } = await supabaseAdmin
      .from('whatsapp_templates')
      .select('name')
      .eq('merchant_id', merchantId)
      .eq('status', 'APPROVED')
      .limit(1)
      .single()
    if (!template) return

    const firstName = (customerName || '').split(' ')[0] || customerName
    await sendWhatsApp(customerPhone, template.name, [firstName, storeName, String(points)], merchant.whatsapp_phone_number_id, merchant.whatsapp_token)
  } catch {}
}

export async function sendWhatsApp(
  to: string,
  templateName: string,
  variables: string[],
  phoneNumberId: string,
  token: string,
): Promise<void> {
  if (!phoneNumberId || !token) throw new Error('WhatsApp not configured for this merchant')

  const normalized = to.replace(/\s+/g, '').replace(/^00/, '+')
  const e164 = normalized.startsWith('+') ? normalized : `+${normalized}`
  const e164Digits = e164.replace('+', '')

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: e164Digits,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: variables.length > 0
          ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }]
          : [],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`WhatsApp API error: ${JSON.stringify(err)}`)
  }
}
