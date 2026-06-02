import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { logError } from '@/lib/log'

// Safety net: recompute each customer's spendable points from the transaction
// ledger and fix any drift. Every points mutation writes a matching
// point_transactions row, so SUM(points) is the source of truth for the balance.
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin.rpc('reconcile_customer_points')
  if (error) {
    logError('admin.reconcile', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fixed: data ?? 0 })
}
