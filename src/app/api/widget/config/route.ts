import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400, headers: cors })

  const { data } = await supabaseAdmin
    .from('merchants')
    .select('id, store_name, widget_primary_color, widget_position, widget_title, points_per_dollar, signup_bonus, social_follow_url, follow_points')
    .eq('shopify_domain', shop)
    .single()

  if (!data) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: offers } = await supabaseAdmin
    .from('offers').select('id, name, description, points_required, offer_type, offer_value')
    .eq('merchant_id', data.id).eq('active', true).order('points_required')

  return NextResponse.json({ ...data, offers: offers || [] }, { headers: cors })
}
