import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints-shopify.vercel.app'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('uid')
  const merchantId = searchParams.get('mid')

  if (customerId && merchantId) {
    await supabaseAdmin.from('customers')
      .update({ marketing_consent: false })
      .eq('id', customerId)
      .eq('merchant_id', merchantId)
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#e0e0f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .card{background:#16162a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;text-align:center;max-width:400px}
      h2{margin:0 0 8px;font-size:1.3rem}p{color:#8080a0;font-size:.9rem;margin:0}
    </style></head><body>
      <div class="card">
        <div style="font-size:2rem;margin-bottom:16px">✓</div>
        <h2>You've been unsubscribed</h2>
        <p>You won't receive marketing emails from this store anymore.</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
