import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  const email = req.nextUrl.searchParams.get('email')
  if (!shop || !email) return NextResponse.json([], { status: 200 })

  const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json([])

  const { data: customer } = await supabaseAdmin.from('customers').select('id').eq('merchant_id', merchant.id).eq('email', email).single()
  if (!customer) return NextResponse.json([])

  const { data } = await supabaseAdmin
    .from('point_transactions').select('*').eq('customer_id', customer.id)
    .order('created_at', { ascending: false }).limit(20)

  return NextResponse.json(data || [])
}
