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
    .from('customers').select('id, name, points, tier').eq('merchant_id', merchant.id).eq('email', email).single()
  if (!customer) return NextResponse.json({ found: false }, { headers: cors })

  return NextResponse.json({ found: true, customer }, { headers: cors })
}
