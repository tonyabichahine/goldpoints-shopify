import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST: add domain to Resend, save domain ID + records to merchant
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { merchant_id, from_email } = await req.json()
  if (!merchant_id || !from_email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const domain = from_email.split('@')[1]
  if (!domain) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })

  try {
    const result = await resend.domains.create({ name: domain })
    if (!result.data) return NextResponse.json({ error: result.error?.message || 'Resend error' }, { status: 500 })

    await supabaseAdmin.from('merchants').update({
      is_premium: true,
      custom_from_email: from_email,
      resend_domain_id: result.data.id,
      custom_domain_status: 'pending',
    }).eq('id', merchant_id)

    return NextResponse.json({ ok: true, records: (result.data as any).records || [], domain_id: result.data.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: fetch current DNS records + status from Resend
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const merchantId = req.nextUrl.searchParams.get('merchant_id')
  if (!merchantId) return NextResponse.json({ error: 'Missing merchant_id' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('resend_domain_id, custom_domain_status').eq('id', merchantId).single()

  if (!merchant?.resend_domain_id) return NextResponse.json({ status: 'not_started', records: [] })

  try {
    const result = await resend.domains.get(merchant.resend_domain_id)
    if (!result.data) return NextResponse.json({ status: merchant.custom_domain_status || 'pending', records: [] })

    const status = (result.data as any).status === 'verified' ? 'verified' : 'pending'
    if (status !== merchant.custom_domain_status) {
      await supabaseAdmin.from('merchants').update({ custom_domain_status: status }).eq('id', merchantId)
    }
    return NextResponse.json({ status, records: (result.data as any).records || [] })
  } catch {
    return NextResponse.json({ status: merchant.custom_domain_status || 'pending', records: [] })
  }
}

// PATCH: trigger Resend verification check
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { merchant_id } = await req.json()
  if (!merchant_id) return NextResponse.json({ error: 'Missing merchant_id' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin
    .from('merchants').select('resend_domain_id').eq('id', merchant_id).single()

  if (!merchant?.resend_domain_id) return NextResponse.json({ error: 'No domain added yet' }, { status: 400 })

  try {
    await resend.domains.verify(merchant.resend_domain_id)
    const result = await resend.domains.get(merchant.resend_domain_id)
    const status = (result.data as any)?.status === 'verified' ? 'verified' : 'pending'
    await supabaseAdmin.from('merchants').update({ custom_domain_status: status }).eq('id', merchant_id)
    return NextResponse.json({ ok: true, status, records: (result.data as any)?.records || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
