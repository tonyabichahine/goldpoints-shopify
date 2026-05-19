import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === (process.env.ADMIN_PASSWORD || 'admin123')
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, active, is_premium, custom_from_email } = body
  const update: Record<string, any> = {}
  if (active !== undefined) update.active = active
  if (is_premium !== undefined) update.is_premium = is_premium
  if (custom_from_email !== undefined) update.custom_from_email = custom_from_email
  await supabaseAdmin.from('merchants').update(update).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await supabaseAdmin.from('merchants').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
