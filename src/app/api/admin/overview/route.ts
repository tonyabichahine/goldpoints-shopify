import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const pw = req.cookies.get('admin_session')?.value
  if (pw !== (process.env.ADMIN_PASSWORD || 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: merchants }, { data: customers }, { data: transactions }, { data: redemptions }] = await Promise.all([
    supabaseAdmin.from('merchants').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('customers').select('merchant_id, points'),
    supabaseAdmin.from('point_transactions').select('merchant_id, points'),
    supabaseAdmin.from('redemptions').select('id'),
  ])

  const customersByMerchant: Record<string, number> = {}
  const pointsByMerchant: Record<string, number> = {}

  for (const c of customers || []) {
    customersByMerchant[c.merchant_id] = (customersByMerchant[c.merchant_id] || 0) + 1
    pointsByMerchant[c.merchant_id] = (pointsByMerchant[c.merchant_id] || 0) + (c.points || 0)
  }

  const totalPoints = Object.values(pointsByMerchant).reduce((a, b) => a + b, 0)

  return NextResponse.json({
    merchants: merchants || [],
    totalCustomers: customers?.length || 0,
    totalPoints,
    totalRedemptions: redemptions?.length || 0,
    customersByMerchant,
    pointsByMerchant,
  })
}
