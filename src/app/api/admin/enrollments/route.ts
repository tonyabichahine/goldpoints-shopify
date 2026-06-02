import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: counts of errored and active enrollments
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ count: errorCount }, { count: activeCount }] = await Promise.all([
    supabaseAdmin.from('automation_enrollments').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    supabaseAdmin.from('automation_enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return NextResponse.json({ errorCount: errorCount ?? 0, activeCount: activeCount ?? 0 })
}

// PATCH: reset all errored enrollments back to active
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabaseAdmin.from('automation_enrollments')
    .update({ status: 'active', error_count: 0, last_error: null })
    .eq('status', 'error')
  return NextResponse.json({ ok: true })
}
