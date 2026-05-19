import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildCampaignEmailPayload } from '@/lib/email'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const BATCH_SIZE = 100

function getMerchantId(req: NextRequest) {
  return req.cookies.get('merchant_session')?.value || null
}

async function getSegmentCustomers(merchantId: string, segment: string): Promise<{ id: string; email: string; name: string; points: number; tier: string }[]> {
  const base = () => supabaseAdmin.from('customers').select('id, email, name, points, tier').eq('merchant_id', merchantId)

  if (segment === 'all') {
    const { data } = await base()
    return data || []
  }
  if (['Bronze', 'Silver', 'Gold'].includes(segment)) {
    const { data } = await base().eq('tier', segment)
    return data || []
  }
  if (segment === 'never') {
    const { data: withPurchase } = await supabaseAdmin
      .from('point_transactions').select('customer_id').eq('merchant_id', merchantId).in('type', ['earn_purchase', 'earn_order'])
    const ids = [...new Set((withPurchase || []).map((r: any) => r.customer_id))]
    if (ids.length === 0) {
      const { data } = await base()
      return data || []
    }
    const { data } = await base().not('id', 'in', `(${ids.join(',')})`)
    return data || []
  }
  const dayRanges: Record<string, [number, number]> = {
    active: [0, 30], at_risk: [31, 60], dormant: [61, 90],
  }
  const [minDays, maxDays] = dayRanges[segment] || [0, 30]
  const from = new Date(Date.now() - maxDays * 86400000).toISOString()
  const to = new Date(Date.now() - minDays * 86400000).toISOString()
  const { data: txRows } = await supabaseAdmin
    .from('point_transactions').select('customer_id').eq('merchant_id', merchantId)
    .in('type', ['earn_purchase', 'earn_order']).gte('created_at', from).lte('created_at', to)
  const ids = [...new Set((txRows || []).map((r: any) => r.customer_id))]
  if (ids.length === 0) return []
  const { data } = await base().in('id', ids)
  return data || []
}

export async function POST(req: NextRequest) {
  const merchantId = getMerchantId(req)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { name, subject, emailBody, segment } = await req.json()
  if (!name || !subject || !emailBody) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: merchant } = await supabaseAdmin.from('merchants').select('store_name, shopify_domain').eq('id', merchantId).single()
  const storeName = merchant?.store_name || 'Our Store'
  const shopifyDomain = merchant?.shopify_domain || ''

  const customers = await getSegmentCustomers(merchantId, segment || 'all')
  if (customers.length === 0) return NextResponse.json({ error: 'No customers in this segment' }, { status: 400 })

  // Save campaign first so we have an ID for tracked links
  let campaign: any = null
  try {
    const { data, error: insertError } = await supabaseAdmin.from('campaigns')
      .insert({ merchant_id: merchantId, name, subject, body: emailBody, segment: segment || 'all', recipient_count: customers.length })
      .select()
    if (insertError) return NextResponse.json({ error: 'Failed to create campaign', detail: insertError.message }, { status: 500 })
    campaign = data?.[0]
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create campaign', detail: e?.message }, { status: 500 })
  }
  if (!campaign) return NextResponse.json({ error: 'Campaign insert returned no data' }, { status: 500 })

  // Insert all campaign_sends with sent_at null — cron can recover any that fail
  const { data: insertedSends } = await supabaseAdmin.from('campaign_sends')
    .insert(customers.map(c => ({ campaign_id: campaign.id, merchant_id: merchantId, customer_id: c.id })))
    .select('id, customer_id')

  const sendIdMap: Record<string, string> = {}
  for (const s of insertedSends || []) sendIdMap[s.customer_id] = s.id

  // Build all email payloads
  const payloads = customers.map(c => {
    const firstName = (c.name || c.email).split(' ')[0]
    const sub = (s: string) => s
      .replace(/\{\{name\}\}/g, firstName).replace(/\{\{points\}\}/g, String(c.points))
      .replace(/\{\{tier\}\}/g, c.tier).replace(/\{\{store\}\}/g, storeName)
    return { customerId: c.id, email: buildCampaignEmailPayload(c.email, sub(subject), sub(emailBody), campaign.id, c.id, shopifyDomain) }
  })

  // Send in batches of 100 via Resend batch API
  let sent = 0
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE)
    try {
      await resend.batch.send(batch.map(p => p.email))
      sent += batch.length
      const batchIds = batch.map(p => sendIdMap[p.customerId]).filter(Boolean)
      if (batchIds.length) {
        await supabaseAdmin.from('campaign_sends').update({ sent_at: new Date().toISOString() }).in('id', batchIds)
      }
    } catch {}
  }

  return NextResponse.json({ ok: true, sent, campaign: { ...campaign, attributed_orders: 0, attributed_revenue: 0, link_clicks: 0, revenue_per_email: 0 } })
}
