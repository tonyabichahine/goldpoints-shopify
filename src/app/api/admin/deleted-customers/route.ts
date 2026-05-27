import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isAdmin(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === (process.env.ADMIN_PASSWORD || 'admin123')
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, points, tier, lifetime_points, deleted_at, merchant_id, merchants(store_name)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (action === 'restore') {
    await supabaseAdmin.from('customers').update({ deleted_at: null, deleted_by_merchant_id: null }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    await supabaseAdmin.from('customers').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
