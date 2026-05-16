import { NextRequest, NextResponse } from 'next/server'
import { getInstallUrl } from '@/lib/shopify'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  const merchantId = req.nextUrl.searchParams.get('merchant_id') || ''
  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = merchantId ? `${nonce}:${merchantId}` : nonce
  const url = getInstallUrl(shop, state)

  const res = NextResponse.redirect(url)
  res.cookies.set('shopify_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600 })
  return res
}
