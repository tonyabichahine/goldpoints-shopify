import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier } from '@/lib/shopify'

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const customerId = req.nextUrl.searchParams.get('id')
  if (customerId) {
    const [{ data: customer }, { data: history }] = await Promise.all([
      supabaseAdmin.from('customers').select('*').eq('id', customerId).eq('merchant_id', merchantId).single(),
      supabaseAdmin.from('point_transactions').select('type, points, description, created_at').eq('customer_id', customerId).eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(20),
    ])
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...customer, history: history || [] })
  }

  const { data } = await supabaseAdmin.from('customers').select('*').eq('merchant_id', merchantId).is('deleted_at', null).order('points', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { name, email, phone, birthday, points } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const { data: existing } = await supabaseAdmin.from('customers').select('id').eq('merchant_id', merchantId).eq('email', email.toLowerCase()).single()
  if (existing) return NextResponse.json({ error: 'A customer with this email already exists' }, { status: 409 })

  const { data: merchant } = await supabaseAdmin.from('merchants').select('tier_silver, tier_gold, signup_bonus').eq('id', merchantId).single()
  const initialPoints = (points || 0) + (merchant?.signup_bonus || 0)
  const tier = getTier(initialPoints, merchant?.tier_silver ?? 500, merchant?.tier_gold ?? 1000)

  const { data, error } = await supabaseAdmin.from('customers').insert({
    merchant_id: merchantId,
    email: email.toLowerCase().trim(),
    name: name?.trim() || null,
    phone: phone?.trim() || null,
    birthday: birthday || null,
    points: initialPoints,
    lifetime_points: initialPoints,
    tier,
    referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (initialPoints > 0) {
    await supabaseAdmin.from('point_transactions').insert({ merchant_id: merchantId, customer_id: data.id, type: 'earn_signup', points: initialPoints, description: 'Added by merchant' })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id, name, phone, birthday, points_adjust } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (birthday !== undefined) updates.birthday = birthday

  if (points_adjust && points_adjust !== 0) {
    const { data: customer } = await supabaseAdmin.from('customers').select('points, lifetime_points').eq('id', id).eq('merchant_id', merchantId).single()
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    updates.points = Math.max(0, (customer.points || 0) + points_adjust)
    if (points_adjust > 0) updates.lifetime_points = (customer.lifetime_points || 0) + points_adjust
    await supabaseAdmin.from('point_transactions').insert({ merchant_id: merchantId, customer_id: id, type: points_adjust > 0 ? 'earn_adjustment' : 'deduct_adjustment', points: points_adjust, description: 'Manual adjustment by merchant' })
  }

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin.from('customers').update(updates).eq('id', id).eq('merchant_id', merchantId)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await Promise.all([
    supabaseAdmin.from('customers').update({ deleted_at: new Date().toISOString(), deleted_by_merchant_id: merchantId }).eq('id', id).eq('merchant_id', merchantId),
    supabaseAdmin.from('automation_enrollments').update({ status: 'cancelled' }).eq('customer_id', id).eq('merchant_id', merchantId).eq('status', 'active'),
  ])
  return NextResponse.json({ ok: true })
}
