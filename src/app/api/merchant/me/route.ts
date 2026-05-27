import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants')
    .select('id, store_name, shopify_domain, email, widget_primary_color, widget_btn_text_color, widget_position, widget_offset_bottom, widget_offset_side, widget_title, points_per_dollar, signup_bonus, birthday_bonus, social_follow_url, follow_points, referral_points, shopify_access_token, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_credits, is_premium, tier_silver, tier_gold, tier_bronze_multiplier, tier_silver_multiplier, tier_gold_multiplier, tier_silver_bonus, tier_gold_bonus, trial_ends_at, whatsapp_auto_notify')
    .eq('id', merchantId)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: offers } = await supabaseAdmin
    .from('offers').select('id, name, description, points_required, offer_type, offer_value')
    .eq('merchant_id', merchant.id).eq('active', true).order('points_required')

  return NextResponse.json({ ...merchant, offers: offers || [] })
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('merchant_session')
  return res
}
