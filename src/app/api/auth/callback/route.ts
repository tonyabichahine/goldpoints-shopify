import { NextRequest, NextResponse } from 'next/server'
import { exchangeToken, shopifyFetch, APP_URL } from '@/lib/shopify'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const shop = searchParams.get('shop')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('shopify_state')?.value

  if (!shop || !code || !state || !storedState) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
  }

  // State may be "nonce" or "nonce:merchantId"
  const [nonce, merchantId] = storedState.split(':')
  const [incomingNonce] = state.split(':')
  if (incomingNonce !== nonce) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
  }

  try {
    const accessToken = await exchangeToken(shop, code)
    const shopData = await shopifyFetch(shop, accessToken, 'shop.json')
    const { name, email } = shopData.shop || {}

    const res = NextResponse.redirect(`${APP_URL}/merchant`)
    res.cookies.delete('shopify_state')

    if (merchantId) {
      // Update existing merchant with Shopify connection
      await supabaseAdmin.from('merchants').update({
        shopify_domain: shop, shopify_access_token: accessToken,
        store_name: name, email: email,
      }).eq('id', merchantId)
    } else {
      // Legacy: upsert by domain (fallback)
      await supabaseAdmin.from('merchants')
        .upsert({ shopify_domain: shop, shopify_access_token: accessToken, store_name: name, email }, { onConflict: 'shopify_domain' })
        .select().single()
      res.cookies.set('merchant_session', '', { httpOnly: true, maxAge: 0 })
    }

    // Auto-register orders/paid webhook (ignore errors — may already exist)
    try {
      await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook: { topic: 'orders/paid', address: `${APP_URL}/api/webhooks/orders`, format: 'json' } }),
      })
    } catch { /* non-fatal */ }

    return res
  } catch {
    return NextResponse.redirect(`${APP_URL}/?error=auth_failed`)
  }
}
