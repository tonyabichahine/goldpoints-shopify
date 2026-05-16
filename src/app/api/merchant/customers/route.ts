import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await supabaseAdmin.from('customers').select('*').eq('merchant_id', merchantId).order('points', { ascending: false })
  return NextResponse.json(data || [])
}
