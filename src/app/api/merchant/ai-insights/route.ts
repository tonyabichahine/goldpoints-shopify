import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const merchantId = req.cookies.get('merchant_session')?.value
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: merchant },
    { count: totalCustomers },
    { data: txAll },
    { count: totalRedemptions },
    { data: topCustomers },
    { data: newCustomers7 },
    { data: newCustomers14 },
    { data: atRisk },
  ] = await Promise.all([
    supabaseAdmin.from('merchants').select('store_name, points_per_dollar, signup_bonus').eq('id', merchantId).single(),
    supabaseAdmin.from('customers').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    supabaseAdmin.from('point_transactions').select('points, type, created_at').eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('redemptions').select('*', { count: 'exact', head: true }).eq('merchant_id', merchantId).gte('created_at', since30),
    supabaseAdmin.from('customers').select('name, points, tier, created_at').eq('merchant_id', merchantId).order('points', { ascending: false }).limit(5),
    supabaseAdmin.from('customers').select('id').eq('merchant_id', merchantId).gte('created_at', since7),
    supabaseAdmin.from('customers').select('id').eq('merchant_id', merchantId).gte('created_at', since14),
    supabaseAdmin.from('customers').select('name, points, tier').eq('merchant_id', merchantId).gt('points', 0).order('points', { ascending: true }).limit(5),
  ])

  const pointsIssued = (txAll || []).filter(t => t.points > 0).reduce((s, t) => s + t.points, 0)
  const pointsRedeemed = Math.abs((txAll || []).filter(t => t.points < 0 && t.type === 'redeem').reduce((s, t) => s + t.points, 0))
  const redemptionRate = totalCustomers ? ((totalRedemptions || 0) / totalCustomers * 100).toFixed(1) : 0

  const prompt = `You are an expert loyalty program analyst. Analyze this Shopify merchant's GoldPoints loyalty program data and give 4-5 short, specific, actionable insights. Be direct and practical. Use plain language — no fluff, no generic advice.

Store: ${merchant?.store_name}
Program settings: ${merchant?.points_per_dollar} points per $1 spent, ${merchant?.signup_bonus} point sign-up bonus

Last 30 days:
- Total members: ${totalCustomers}
- New members (last 7 days): ${newCustomers7?.length || 0}
- New members (last 14 days): ${newCustomers14?.length || 0}
- Points issued: ${pointsIssued.toLocaleString()}
- Points redeemed: ${pointsRedeemed.toLocaleString()}
- Redemptions made: ${totalRedemptions || 0}
- Redemption rate: ${redemptionRate}% of members have redeemed

Top customers by points:
${(topCustomers || []).map(c => `- ${c.name}: ${c.points} pts (${c.tier})`).join('\n')}

Customers with low points (at risk of disengagement):
${(atRisk || []).map(c => `- ${c.name}: ${c.points} pts (${c.tier})`).join('\n')}

Write exactly 4-5 bullet points (start each with •). Each insight should be 1-2 sentences max. Focus on what the merchant should DO next or what stands out in the data.`

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    }),
  })

  if (!groqRes.ok) return NextResponse.json({ error: 'AI unavailable' }, { status: 502 })

  const groqData = await groqRes.json()
  const text: string = groqData.choices?.[0]?.message?.content || ''

  const insights = text
    .split('\n')
    .map((l: string) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter((l: string) => l.length > 10)

  return NextResponse.json({ insights, generatedAt: new Date().toISOString() })
}
