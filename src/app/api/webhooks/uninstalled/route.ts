import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SHOPIFY_API_SECRET } from '@/lib/shopify'
import { logError } from '@/lib/log'
import crypto from 'crypto'

// Fired by Shopify when a merchant removes the app. The access token is already
// revoked at this point, so we clear it and mark the merchant inactive.
export async function POST(req: NextRequest) {
  const shop = req.headers.get('x-shopify-shop-domain') || ''
  const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
  const body = await req.text()

  const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64')
  if (hash !== hmac) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!shop) return NextResponse.json({ ok: true })

  const { error } = await supabaseAdmin
    .from('merchants')
    .update({ active: false, shopify_access_token: null })
    .eq('shopify_domain', shop)
  if (error) logError('uninstalled.update', error)

  return NextResponse.json({ ok: true })
}
