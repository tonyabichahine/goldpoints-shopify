import twilio from 'twilio'

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const from = process.env.TWILIO_WHATSAPP_FROM || '+14155238886'
  const normalized = to.replace(/\s+/g, '').replace(/^00/, '+')
  const e164 = normalized.startsWith('+') ? normalized : `+${normalized}`
  await client.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${e164}`,
    body,
  })
}
