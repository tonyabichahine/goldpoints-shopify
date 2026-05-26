import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTier, buildUpgradeBonusData, SHOPIFY_API_SECRET, tagShopifyCustomer } from '@/lib/shopify'
import { fireAutomation, enrollInFlows } from '@/lib/email'
import crypto from 'crypto'

async function awardCampaignBonus(campaignId: string, merchantId: string, customerId: string, currentPoints: number) {
  const { data: campaign } = await supabaseAdmin.from('campaigns').select('bonus_points').eq('id', campaignId).single()
  const bonus = campaign?.bonus_points || 0
  if (bonus <= 0) return
  await Promise.all([
    supabaseAdmin.from('customers').update({ points: currentPoints + bonus }).eq('id', customerId),
    supabaseAdmin.from('point_transactions').insert({
      merchant_id: merchantId, customer_id: customerId,
      type: 'earn_campaign_bonus', points: bonus,
      description: 'Campaign purchase bonus',
    }),
  ])
}

export async function POST(req: NextRequest) {
  const shop = req.headers.get('x-shopify-shop-domain') || ''
  const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
  const body = await req.text()

  const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(body).digest('base64')
  if (hash !== hmac) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = JSON.parse(body)
  const customerEmail = order.email
  if (!customerEmail) return NextResponse.json({ ok: true })

  const { data: merchant } = await supabaseAdmin
    .from('merchants')
    .select('id, store_name, shopify_access_token, points_per_dollar, tier_silver, tier_gold, tier_bronze_multiplier, tier_silver_multiplier, tier_gold_multiplier, tier_silver_bonus, tier_gold_bonus, attribution_window_days')
    .eq('shopify_domain', shop).single()
  if (!merchant) return NextResponse.json({ ok: true })

  const orderTotal = parseFloat(order.total_price || '0')
  const basePoints = Math.floor(orderTotal * merchant.points_per_dollar)
  if (basePoints <= 0) return NextResponse.json({ ok: true })

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, points, tier, lifetime_points, silver_bonus_awarded, gold_bonus_awarded, shopify_customer_id, name, email')
    .eq('merchant_id', merchant.id).eq('email', customerEmail).single()
  if (!customer) return NextResponse.json({ ok: true })

  const shopifyCustomerId = String(order.customer?.id || '')
  if (shopifyCustomerId && !customer.shopify_customer_id) {
    supabaseAdmin.from('customers').update({ shopify_customer_id: shopifyCustomerId }).eq('id', customer.id).then(() => {})
  }
  const effectiveShopifyId = shopifyCustomerId || customer.shopify_customer_id || ''

  const multiplierMap: Record<string, number> = {
    Bronze: merchant.tier_bronze_multiplier ?? 1.0,
    Silver: merchant.tier_silver_multiplier ?? 1.5,
    Gold:   merchant.tier_gold_multiplier   ?? 2.0,
  }
  const multiplier = multiplierMap[customer.tier] ?? 1.0
  const pointsEarned = Math.floor(basePoints * multiplier)

  const newLifetime = (customer.lifetime_points ?? 0) + pointsEarned
  const newTier = getTier(newLifetime, merchant.tier_silver ?? 500, merchant.tier_gold ?? 1000)

  const { extraPoints, customerUpdates: bonusUpdates, transactions: bonusTxs } = buildUpgradeBonusData(
    merchant.id, customer.id, customer.tier, newTier,
    merchant.tier_silver_bonus ?? 0, merchant.tier_gold_bonus ?? 0,
    customer.silver_bonus_awarded ?? false, customer.gold_bonus_awarded ?? false,
  )

  const newPoints = customer.points + pointsEarned + extraPoints

  await Promise.all([
    supabaseAdmin.from('customers').update({
      points: newPoints,
      lifetime_points: newLifetime + extraPoints,
      tier: newTier,
      ...bonusUpdates,
    }).eq('id', customer.id),
    supabaseAdmin.from('point_transactions').insert([
      {
        merchant_id: merchant.id, customer_id: customer.id,
        type: 'earn_purchase', points: pointsEarned,
        shopify_order_id: String(order.id),
        description: `Order #${order.order_number} — $${orderTotal}${multiplier !== 1 ? ` (${multiplier}× ${customer.tier})` : ''}`,
      },
      ...bonusTxs,
    ]),
  ])

  if (effectiveShopifyId) {
    tagShopifyCustomer(merchant.shopify_access_token, shop, effectiveShopifyId, newTier).catch(() => {})
  }

  // Campaign attribution: click-based first (stronger), then send-based fallback
  const windowDays = merchant.attribution_window_days ?? 7
  const attributionWindow = new Date(Date.now() - windowDays * 86400000).toISOString()
  ;(async () => {
    try {
      // Prefer click attribution (customer clicked a campaign link before ordering)
      const { data: click } = await supabaseAdmin.from('campaign_clicks')
        .select('campaign_id')
        .eq('customer_id', customer.id)
        .eq('merchant_id', merchant.id)
        .gte('clicked_at', attributionWindow)
        .order('clicked_at', { ascending: false })
        .limit(1).single()

      const campaignId = click?.campaign_id
      if (campaignId) {
        await supabaseAdmin.from('campaign_attributions').insert({
          campaign_id: campaignId, merchant_id: merchant.id, customer_id: customer.id,
          shopify_order_id: String(order.id), revenue: orderTotal, attributed_via: 'click',
        })
        await awardCampaignBonus(campaignId, merchant.id, customer.id, newPoints)
        return
      }

      // Fall back to send-based attribution (received email within window)
      const { data: send } = await supabaseAdmin.from('campaign_sends')
        .select('campaign_id')
        .eq('customer_id', customer.id)
        .gte('sent_at', attributionWindow)
        .order('sent_at', { ascending: false })
        .limit(1).single()
      if (!send) return
      await supabaseAdmin.from('campaign_attributions').insert({
        campaign_id: send.campaign_id, merchant_id: merchant.id, customer_id: customer.id,
        shopify_order_id: String(order.id), revenue: orderTotal, attributed_via: 'send',
      })
      await awardCampaignBonus(send.campaign_id, merchant.id, customer.id, newPoints)
    } catch {}
  })()

  // Flow attribution: last-touch within attribution window, split by channel
  ;(async () => {
    try {
      const { data: flowSend } = await supabaseAdmin
        .from('flow_sends')
        .select('flow_id, channel')
        .eq('customer_id', customer.id)
        .eq('merchant_id', merchant.id)
        .gte('sent_at', attributionWindow)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()
      if (flowSend) {
        await supabaseAdmin.from('flow_attributions').insert({
          flow_id: flowSend.flow_id, merchant_id: merchant.id, customer_id: customer.id,
          shopify_order_id: String(order.id), revenue: orderTotal, channel: flowSend.channel,
        })
      }
    } catch {}
  })()

  if (newTier !== customer.tier) {
    const trigger = newTier === 'Gold' ? 'tier_gold' : newTier === 'Silver' ? 'tier_silver' : null
    if (trigger) {
      fireAutomation(merchant.id, trigger, {
        email: customerEmail, name: customer.name || customerEmail, points: newPoints, tier: newTier,
      }, merchant.store_name).catch(() => {})
      enrollInFlows(merchant.id, customer.id, trigger).catch(() => {})
    }
  }

  // First purchase + points milestone triggers — run async so they don't slow the webhook response
  ;(async () => {
    try {
      const { count: earnCount } = await supabaseAdmin
        .from('point_transactions').select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id).eq('customer_id', customer.id).eq('type', 'earn_purchase')
      if ((earnCount || 0) === 1) {
        enrollInFlows(merchant.id, customer.id, 'first_purchase').catch(() => {})
      }

      const { data: milestoneFlows } = await supabaseAdmin
        .from('automation_flows').select('id, nodes, edges, allow_reenroll')
        .eq('merchant_id', merchant.id).eq('trigger', 'points_milestone').eq('active', true)
      for (const flow of milestoneFlows || []) {
        const nodes: any[] = flow.nodes || []
        const edges: any[] = flow.edges || []
        const triggerNode = nodes.find((n: any) => n.type === 'trigger')
        const milestone = triggerNode?.data?.milestoneValue
        if (!milestone || typeof milestone !== 'number') continue
        // Only enroll when the customer just crossed this specific threshold
        if (customer.points < milestone && newPoints >= milestone) {
          const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null
          if (!firstEdge) continue
          const payload = {
            flow_id: flow.id, merchant_id: merchant.id, customer_id: customer.id,
            current_node_id: firstEdge.target, next_run_at: new Date().toISOString(),
            status: 'active', enrolled_at: new Date().toISOString(),
          }
          if (flow.allow_reenroll) {
            await supabaseAdmin.from('automation_enrollments').upsert(payload, { onConflict: 'flow_id,customer_id' })
          } else {
            await supabaseAdmin.from('automation_enrollments').upsert(payload, { onConflict: 'flow_id,customer_id', ignoreDuplicates: true })
          }
        }
      }
    } catch {}
  })()

  return NextResponse.json({ ok: true })
}
