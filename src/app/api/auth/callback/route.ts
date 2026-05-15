import { NextRequest, NextResponse } from 'next/server'
import { exchangeToken, shopifyFetch, APP_URL } from '@/lib/shopify'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const shop = searchParams.get('shop')
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('shopify_state')?.value

  if (!shop || !code || !state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
  }

  try {
    const accessToken = await exchangeToken(shop, code)
    const shopData = await shopifyFetch(shop, accessToken, 'shop.json')
    const { name, email } = shopData.shop || {}

    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .upsert({ shopify_domain: shop, shopify_access_token: accessToken, store_name: name, email }, { onConflict: 'shopify_domain' })
      .select()
      .single()

    const res = NextResponse.redirect(`${APP_URL}/merchant?shop=${shop}`)
    res.cookies.set('merchant_shop', shop, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    res.cookies.delete('shopify_state')
    return res
  } catch {
    return NextResponse.redirect(`${APP_URL}/?error=auth_failed`)
  }
}
