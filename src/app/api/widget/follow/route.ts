import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors })
}

export async function POST(req: NextRequest) {
  const { shop, email } = await req.json()
  if (!shop || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: cors })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('id, follow_points').eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ error: 'Store not found' }, { status: 404, headers: cors })

  const { data: customer } = await supabaseAdmin
    .from('customers').select('id, points').eq('merchant_id', merchant.id).eq('email', email).single()
  if (!customer) return NextResponse.json({ error: 'Account not found' }, { status: 404, headers: cors })

  // Check if already claimed
  const { data: existing } = await supabaseAdmin
    .from('point_transactions')
    .select('id').eq('customer_id', customer.id).eq('type', 'earn_follow').single()
  if (existing) return NextResponse.json({ error: 'You have already claimed your follow reward.' }, { status: 400, headers: cors })

  const pts = merchant.follow_points || 50
  const newPoints = customer.points + pts

  await supabaseAdmin.from('customers').update({ points: newPoints }).eq('id', customer.id)
  await supabaseAdmin.from('point_transactions').insert({
    merchant_id: merchant.id, customer_id: customer.id,
    type: 'earn_follow', points: pts, description: 'Followed on social media',
  })

  return NextResponse.json({ newPoints, pointsEarned: pts }, { headers: cors })
}
