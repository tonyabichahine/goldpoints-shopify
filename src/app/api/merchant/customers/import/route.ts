import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier } from '@/lib/shopify'

export async function POST(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const text = await req.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
  const emailIdx = headers.indexOf('email')
  if (emailIdx === -1) return NextResponse.json({ error: 'CSV must have an "email" column' }, { status: 400 })

  const nameIdx = headers.indexOf('name')
  const phoneIdx = headers.indexOf('phone')
  const birthdayIdx = headers.indexOf('birthday')
  const pointsIdx = headers.indexOf('points')

  const { data: merchant } = await supabaseAdmin.from('merchants').select('tier_silver, tier_gold').eq('id', merchantId).single()
  const { data: existing } = await supabaseAdmin.from('customers').select('email').eq('merchant_id', merchantId)
  const existingEmails = new Set((existing || []).map(c => c.email.toLowerCase()))

  let created = 0, skipped = 0
  const errors: string[] = []
  const toInsert: any[] = []
  const pointRows: { customer_id?: string; points: number }[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    const email = cols[emailIdx]?.toLowerCase()
    if (!email) { errors.push(`Row ${i + 1}: missing email`); continue }
    if (existingEmails.has(email)) { skipped++; continue }

    const points = pointsIdx >= 0 ? parseInt(cols[pointsIdx] || '0') || 0 : 0
    const tier = getTier(points, merchant?.tier_silver ?? 500, merchant?.tier_gold ?? 1000)

    toInsert.push({
      merchant_id: merchantId,
      email,
      name: nameIdx >= 0 ? cols[nameIdx] || null : null,
      phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
      birthday: birthdayIdx >= 0 ? cols[birthdayIdx] || null : null,
      points,
      lifetime_points: points,
      tier,
      referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    })
    existingEmails.add(email)
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabaseAdmin.from('customers').insert(toInsert).select('id, points')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    created = inserted?.length || 0

    const txs = (inserted || []).filter(c => c.points > 0).map(c => ({
      merchant_id: merchantId, customer_id: c.id, type: 'earn_signup', points: c.points, description: 'Imported by merchant',
    }))
    if (txs.length > 0) await supabaseAdmin.from('point_transactions').insert(txs)
  }

  return NextResponse.json({ ok: true, created, skipped, errors, message: `Imported ${created} customer${created !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped} duplicates` : ''}${errors.length ? `, ${errors.length} errors` : ''}.` })
}
