import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

export async function GET(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await supabaseAdmin.from('campaigns').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function DELETE(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('campaigns').delete().eq('id', id).eq('merchant_id', merchantId)
  return NextResponse.json({ ok: true })
}
