import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop') || req.cookies.get('merchant_shop')?.value
  if (!shop) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json([], { status: 200 })
  const { data } = await supabaseAdmin.from('customers').select('*').eq('merchant_id', merchant.id).order('points', { ascending: false })
  return NextResponse.json(data || [])
}
