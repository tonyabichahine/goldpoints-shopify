import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const allowed = ['widget_primary_color', 'widget_gradient_color', 'widget_btn_text_color', 'widget_position', 'widget_offset_bottom', 'widget_offset_side', 'widget_title', 'points_per_dollar', 'signup_bonus', 'birthday_bonus', 'social_follow_url', 'follow_points', 'referral_points', 'tier_silver', 'tier_gold', 'tier_bronze_multiplier', 'tier_silver_multiplier', 'tier_gold_multiplier', 'tier_silver_bonus', 'tier_gold_bonus', 'attribution_window_days']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) if (body[key] !== undefined) updates[key] = body[key]

  const { error } = await supabaseAdmin.from('merchants').update(updates).eq('id', merchantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
