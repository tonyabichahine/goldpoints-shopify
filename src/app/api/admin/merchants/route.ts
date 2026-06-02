import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, active, is_premium, custom_from_email, add_whatsapp_credits, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_token, mark_paid } = body
  const update: Record<string, any> = {}
  if (active !== undefined) update.active = active
  if (is_premium !== undefined) update.is_premium = is_premium
  if (mark_paid) update.trial_ends_at = null
  if (custom_from_email !== undefined) update.custom_from_email = custom_from_email
  if (whatsapp_phone_number_id !== undefined) update.whatsapp_phone_number_id = whatsapp_phone_number_id
  if (whatsapp_waba_id !== undefined) update.whatsapp_waba_id = whatsapp_waba_id
  if (whatsapp_token !== undefined) update.whatsapp_token = whatsapp_token
  if (add_whatsapp_credits && add_whatsapp_credits > 0) {
    const { data: m } = await supabaseAdmin.from('merchants').select('whatsapp_credits').eq('id', id).single()
    update.whatsapp_credits = (m?.whatsapp_credits || 0) + add_whatsapp_credits
  }
  await supabaseAdmin.from('merchants').update(update).eq('id', id)

  // Subscribe the WABA to our webhook whenever credentials are saved
  if (whatsapp_waba_id && whatsapp_token) {
    await fetch(`https://graph.facebook.com/v18.0/${whatsapp_waba_id}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${whatsapp_token}` },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('merchants').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
