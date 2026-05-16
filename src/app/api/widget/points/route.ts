import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  const email = req.nextUrl.searchParams.get('email')
  if (!shop || !email) return NextResponse.json({ error: 'Missing params' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, name, email, points, tier, birthday, referral_code').eq('merchant_id', merchant.id).eq('email', email).single()
  if (!customer) return NextResponse.json({ found: false }, { headers: cors })

  // Return recent redemption codes so widget can show them even after panel is closed
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: redemptions } = await supabaseAdmin
    .from('redemptions')
    .select('discount_code, created_at, offers(name)')
    .eq('customer_id', customer.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ found: true, customer, redemptions: redemptions || [] }, { headers: cors })
}
