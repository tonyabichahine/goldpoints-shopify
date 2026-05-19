import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('cid')
  const customerId = searchParams.get('uid')
  const destination = searchParams.get('url') || 'https://goldpoints-shopify.vercel.app'

  let safeUrl = destination
  try {
    const parsed = new URL(destination)
    if (!['http:', 'https:'].includes(parsed.protocol)) safeUrl = 'https://goldpoints-shopify.vercel.app'
  } catch {
    safeUrl = 'https://goldpoints-shopify.vercel.app'
  }

  if (campaignId && customerId) {
    const { data: campaign } = await supabaseAdmin.from('campaigns').select('merchant_id').eq('id', campaignId).single()
    if (campaign) {
      void supabaseAdmin.from('campaign_clicks').insert({
        campaign_id: campaignId, customer_id: customerId, merchant_id: campaign.merchant_id,
      })
    }
  }

  const enrollmentId = searchParams.get('eid')
  if (enrollmentId) {
    void supabaseAdmin.from('automation_enrollments')
      .update({ last_email_click_at: new Date().toISOString() })
      .eq('id', enrollmentId)
  }

  return NextResponse.redirect(safeUrl)
}
