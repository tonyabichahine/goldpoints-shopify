export const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!
export const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET!
export const SCOPES = process.env.SHOPIFY_SCOPES || 'read_orders,read_customers,write_discounts'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints-shopify.vercel.app'

export function getInstallUrl(shop: string, state: string) {
  const redirectUri = `${APP_URL}/api/auth/callback`
  return `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
}

export async function exchangeToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: SHOPIFY_API_KEY, client_secret: SHOPIFY_API_SECRET, code }),
  })
  const data = await res.json()
  return data.access_token
}

export async function shopifyFetch(shop: string, token: string, endpoint: string) {
  const res = await fetch(`https://${shop}/admin/api/2024-01/${endpoint}`, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  })
  return res.json()
}

export async function createDiscountCode(shop: string, token: string, code: string, valueType: string, value: string) {
  const body = valueType === 'shipping'
    ? {
        price_rule: {
          title: code, target_type: 'shipping_line', target_selection: 'all',
          allocation_method: 'across', value_type: 'percentage', value: '-100.0',
          customer_selection: 'all', starts_at: new Date().toISOString(), usage_limit: 1,
        }
      }
    : {
        price_rule: {
          title: code, target_type: 'line_item', target_selection: 'all',
          allocation_method: 'across', value_type: 'percentage', value: `-${value}`,
          customer_selection: 'all', starts_at: new Date().toISOString(), usage_limit: 1,
        }
      }

  const ruleRes = await fetch(`https://${shop}/admin/api/2024-01/price_rules.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const { price_rule } = await ruleRes.json()
  if (!price_rule) return null

  const codeRes = await fetch(`https://${shop}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ discount_code: { code } }),
  })
  const { discount_code } = await codeRes.json()
  return discount_code?.code || null
}

export function getTier(points: number, silverThreshold = 500, goldThreshold = 1000) {
  if (points >= goldThreshold) return 'Gold'
  if (points >= silverThreshold) return 'Silver'
  return 'Bronze'
}

export function buildUpgradeBonusData(
  merchantId: string, customerId: string,
  oldTier: string, newTier: string,
  silverBonus: number, goldBonus: number,
  silverBonusAwarded: boolean, goldBonusAwarded: boolean,
) {
  const customerUpdates: Record<string, unknown> = {}
  const transactions: Array<Record<string, unknown>> = []
  let extraPoints = 0
  if (newTier !== oldTier) {
    if ((newTier === 'Silver' || newTier === 'Gold') && oldTier === 'Bronze' && !silverBonusAwarded && silverBonus > 0) {
      extraPoints += silverBonus
      customerUpdates.silver_bonus_awarded = true
      transactions.push({ merchant_id: merchantId, customer_id: customerId, type: 'earn_tier_bonus', points: silverBonus, description: 'Silver tier upgrade bonus' })
    }
    if (newTier === 'Gold' && !goldBonusAwarded && goldBonus > 0) {
      extraPoints += goldBonus
      customerUpdates.gold_bonus_awarded = true
      transactions.push({ merchant_id: merchantId, customer_id: customerId, type: 'earn_tier_bonus', points: goldBonus, description: 'Gold tier upgrade bonus' })
    }
  }
  return { extraPoints, customerUpdates, transactions }
}
