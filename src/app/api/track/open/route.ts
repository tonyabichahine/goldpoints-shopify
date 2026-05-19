import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const enrollmentId = searchParams.get('eid')
  const campaignId = searchParams.get('cid')
  const customerId = searchParams.get('uid')

  if (enrollmentId) {
    void supabaseAdmin.from('automation_enrollments')
      .update({ last_email_open_at: new Date().toISOString() })
      .eq('id', enrollmentId)
  }

  if (campaignId && customerId) {
    void supabaseAdmin.from('campaign_sends')
      .update({ opened_at: new Date().toISOString() })
      .eq('campaign_id', campaignId)
      .eq('customer_id', customerId)
      .is('opened_at', null)
  }

  return new NextResponse(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
