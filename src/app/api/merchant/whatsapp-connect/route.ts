import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, waba_id, phone_number_id } = await req.json()
  if (!code || !waba_id || !phone_number_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const appId = '1641237980517889'
  const appSecret = process.env.META_APP_SECRET!

  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
  )

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Token exchange failed', detail: err }, { status: 400 })
  }

  const { access_token } = await tokenRes.json()
  if (!access_token) return NextResponse.json({ error: 'No access token received' }, { status: 400 })

  await supabaseAdmin.from('merchants').update({
    whatsapp_waba_id: waba_id,
    whatsapp_phone_number_id: phone_number_id,
    whatsapp_token: access_token,
  }).eq('id', merchantId)

  // Subscribe this WABA to our app's webhook
  await fetch(`https://graph.facebook.com/v18.0/${waba_id}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}` },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
