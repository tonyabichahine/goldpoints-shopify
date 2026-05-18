import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { message, history = [], pageContext = '' } = await req.json()
  if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: merchant },
    { count: totalCustomers },
    { data: txAll },
    { count: totalRedemptions },
    { data: topCustomers },
    { data: newCustomers7 },
    { data: offers },
  ] = await Promise.all([
    supabaseAdmin.from('merchants').select('store_name, points_per_dollar, signup_bonus, referral_points, follow_points').eq('id', merchantId).single(),
    supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type').eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('redemptions').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('customers').select('name, points, tier').eq('merchant_id', merchantId).order('points', { ascending: false }).limit(5),
    supabaseAdmin.from('customers').select('id').eq('merchant_id', merchantId).gte('created_at', since7),
    supabaseAdmin.from('offers').select('name, points_required, offer_type, offer_value, active').eq('merchant_id', merchantId),
  ])

  const pointsIssued = (txAll || []).filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
  const pointsRedeemed = Math.abs((txAll || []).filter(t => t.points < 0 && t.type === 'redeem').reduce((s, t) => s + t.points, 0))
  const redemptionRate = totalCustomers ? ((totalRedemptions || 0) / totalCustomers * 100).toFixed(1) : '0'

  const systemPrompt = `You are an AI assistant inside the GoldPoints loyalty dashboard for ${merchant?.store_name}. You have access to their real store data. Answer questions directly and helpfully — keep replies concise (2-4 sentences) unless the merchant asks for detail. Be specific to their actual numbers. Use plain language, no fluff.

Store data (last 30 days):
- Store: ${merchant?.store_name}
- Total members: ${totalCustomers}
- New members this week: ${newCustomers7?.length || 0}
- Points per $1 spent: ${merchant?.points_per_dollar}
- Sign-up bonus: ${merchant?.signup_bonus} pts | Referral bonus: ${merchant?.referral_points} pts
- Points issued: ${pointsIssued.toLocaleString()} | Points redeemed: ${pointsRedeemed.toLocaleString()}
- Redemptions: ${totalRedemptions || 0} | Redemption rate: ${redemptionRate}%

Top 5 customers:
${(topCustomers || []).map(c => `- ${c.name}: ${c.points} pts (${c.tier})`).join('\n')}

Offers:
${(offers || []).map(o => `- ${o.name}: costs ${o.points_required} pts → ${o.offer_type === 'shipping' ? 'Free shipping' : `${o.offer_value}${o.offer_type === 'percentage' ? '%' : '$'} off`} (${o.active ? 'active' : 'inactive'})`).join('\n') || 'No offers set up yet.'}`

  const fullSystemPrompt = systemPrompt + (pageContext ? `\n\nWhat the merchant is currently looking at on their screen:\n${pageContext}` : '')

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...history.map((m: any) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: message },
      ],
      temperature: 0.6,
      max_tokens: 400,
    }),
  })

  if (!groqRes.ok) return NextResponse.json({ error: 'AI unavailable. Try again.' }, { status: 502 })
  const groqData = await groqRes.json()
  const reply: string = groqData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'
  return NextResponse.json({ reply })
}
