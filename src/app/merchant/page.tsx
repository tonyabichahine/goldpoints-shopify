'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Merchant { id: string; store_name: string; shopify_domain: string; shopify_access_token: string; email: string; widget_primary_color: string; widget_btn_text_color: string; widget_title: string; widget_position: string; widget_offset_bottom: number; widget_offset_side: number; points_per_dollar: number; signup_bonus: number; social_follow_url: string; follow_points: number; referral_points: number; tier_silver: number; tier_gold: number; tier_bronze_multiplier: number; tier_silver_multiplier: number; tier_gold_multiplier: number; tier_silver_bonus: number; tier_gold_bonus: number }
interface Stats { customers: number; total_points: number; gold: number; silver: number; bronze: number }
interface Campaign { id: string; name: string; subject: string; body: string; segment: string; recipient_count: number; created_at: string; attributed_orders: number; attributed_revenue: number }
interface Automation { id: string; trigger: string; name: string; subject: string; body: string; active: boolean; created_at: string }
interface FlowSummary { id: string; name: string; trigger: string; active: boolean; created_at: string }
interface Analytics {
  totalCustomers: number; totalPointsIssued: number; totalPointsRedeemed: number; totalRedemptions: number
  totalPointsLiability: number; campaignRevenue: number; campaignOrders: number
  tierBreakdown: { Bronze: number; Silver: number; Gold: number }
  offerPerformance: { id: string; name: string; count: number; pct: number }[]
  pointsChart: { date: string; value: number }[]; signupsChart: { date: string; value: number }[]
  topCustomers: { name: string; email: string; points: number; tier: string }[]
  recentActivity: { points: number; type: string; description: string; created_at: string; customerName: string }[]
}

const SEGMENT_CONFIG = [
  { key: 'active',  label: 'Active',          days: '≤ 30 days',   color: '#4ade80' },
  { key: 'atRisk',  label: 'At Risk',          days: '31–60 days',  color: '#facc15' },
  { key: 'dormant', label: 'Dormant',          days: '61–90 days',  color: '#fb923c' },
  { key: 'lapsing', label: 'Lapsing',          days: '91–180 days', color: '#f87171' },
  { key: 'lost',    label: 'Lost',             days: '180+ days',   color: '#6b7280' },
  { key: 'never',   label: 'Never Purchased',  days: 'No purchase', color: '#a78bfa' },
]

// Pure CSS conic-gradient donut chart
function DonutChart({ segments, total }: { segments: any; total: number }) {
  if (!total) return <div className="w-36 h-36 rounded-full bg-white/5 flex items-center justify-center text-gray-600 text-xs">No data</div>
  let angle = 0
  const slices = SEGMENT_CONFIG.map(s => {
    const seg = segments[s.key]
    const pct = seg?.count ? seg.count / total : 0
    const start = angle
    angle += pct * 360
    return { ...s, pct, start, end: angle }
  }).filter(s => s.pct > 0)
  const gradient = slices.map(s => `${s.color} ${s.start.toFixed(1)}deg ${s.end.toFixed(1)}deg`).join(', ')
  return (
    <div className="relative w-36 h-36 shrink-0">
      <div className="w-36 h-36 rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
      <div className="absolute inset-[22px] rounded-full bg-[#16162a] flex flex-col items-center justify-center">
        <div className="text-lg font-bold text-white">{total}</div>
        <div className="text-[9px] text-gray-500 leading-tight text-center">members</div>
      </div>
    </div>
  )
}

const TIER_CONFIG = [
  { key: 'Bronze', icon: '🥉', color: '#f97316', dim: 'bg-orange-900/30 border-orange-500/20', text: 'text-orange-400' },
  { key: 'Silver', icon: '🥈', color: '#9ca3af', dim: 'bg-gray-700/30 border-gray-500/20',   text: 'text-gray-300'   },
  { key: 'Gold',   icon: '🥇', color: '#fbbf24', dim: 'bg-yellow-900/30 border-yellow-500/20', text: 'text-yellow-400' },
]

function TierBreakdown({ tiers, total }: { tiers: { Bronze: number; Silver: number; Gold: number }; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-4">
        {TIER_CONFIG.map(t => {
          const pct = total > 0 ? (tiers[t.key as keyof typeof tiers] / total * 100) : 0
          return pct > 0 ? <div key={t.key} style={{ width: `${pct}%`, backgroundColor: t.color }} className="min-w-[4px] transition-all" title={`${t.key}: ${Math.round(pct)}%`} /> : null
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TIER_CONFIG.map(t => {
          const count = tiers[t.key as keyof typeof tiers] || 0
          const pct = total > 0 ? Math.round(count / total * 100) : 0
          return (
            <div key={t.key} className={`rounded-xl p-4 border ${t.dim}`}>
              <div className="text-xl mb-2">{t.icon}</div>
              <div className={`text-2xl font-bold ${t.text}`}>{count}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t.key}</div>
              <div className={`text-sm font-semibold mt-1 ${t.text}`}>{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BarChart({ title, data, color, onSeeAll }: { title: string; data: { date: string; value: number }[]; color: string; onSeeAll?: () => void }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bg-[#16162a] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">{title}</div>
        {onSeeAll && <button onClick={onSeeAll} className="text-xs text-gray-500 hover:text-white transition">See all →</button>}
      </div>
      <div className="flex items-end gap-0.5" style={{ height: '80px' }}>
        {data.map(d => (
          <div key={d.date} className="flex-1 rounded-t-sm" style={{ height: `${(d.value / max) * 80}px`, backgroundColor: color, minHeight: d.value > 0 ? '2px' : '0px' }} />
        ))}
      </div>
      <div className="flex gap-0.5 mt-1">
        {data.map(d => (
          <div key={d.date} className="flex-1 text-center truncate" style={{ fontSize: '8px', color: '#4b5563' }}>{d.date}</div>
        ))}
      </div>
    </div>
  )
}

function MerchantDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'customers' | 'offers' | 'settings' | 'campaigns' | 'flows'>(() => {
    const t = searchParams.get('tab')
    if (t === 'flows' || t === 'campaigns' || t === 'offers' || t === 'customers' || t === 'settings') return t
    return 'overview'
  })
  const [customers, setCustomers] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [newOffer, setNewOffer] = useState({ name: '', description: '', points_required: 500, offer_type: 'percentage', offer_value: '10', min_tier: 'Bronze' })
  const [connectDomain, setConnectDomain] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [currPw, setCurrPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [drawer, setDrawer] = useState<{ type: string | null; data: any[]; loading: boolean; period: string }>({ type: null, data: [], loading: false, period: '30' })
  const [segments, setSegments] = useState<any>(null)
  const [tierFilter, setTierFilter] = useState<'All' | 'Bronze' | 'Silver' | 'Gold'>('All')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [automations, setAutomations] = useState<Automation[]>([])
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [flowsLoading, setFlowsLoading] = useState(false)
  const [creatingFlow, setCreatingFlow] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', body: '', segment: 'all' })
  const [newAutomation, setNewAutomation] = useState({ trigger: 'signup', name: '', subject: '', body: '' })
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignMsg, setCampaignMsg] = useState('')
  const [showAutoForm, setShowAutoForm] = useState(false)
  const [aiChat, setAiChat] = useState<{ open: boolean; messages: { role: 'user' | 'ai'; content: string }[]; loading: boolean; input: string }>({ open: false, messages: [], loading: false, input: '' })
  const aiEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/merchant/me')
      .then(r => { if (r.status === 401) { router.push('/'); return null } return r.json() })
      .then(d => { if (d && !d.error) setMerchant(d); setLoading(false) })
  }, [router])

  useEffect(() => {
    if (tab === 'customers') loadCustomers()
    if (tab === 'offers') loadOffers()
    if (tab === 'overview') loadAnalytics()
    if (tab === 'campaigns') { loadCampaigns(); loadAutomations() }
    if (tab === 'flows') loadFlows()
  }, [tab])

  async function loadCustomers() {
    const r = await fetch('/api/merchant/customers')
    setCustomers(await r.json())
  }

  async function loadOffers() {
    const r = await fetch('/api/merchant/offers')
    setOffers(await r.json())
  }

  async function loadCampaigns() {
    const r = await fetch('/api/merchant/campaigns')
    if (r.ok) setCampaigns(await r.json())
  }

  async function loadAutomations() {
    const r = await fetch('/api/merchant/automations')
    if (r.ok) setAutomations(await r.json())
  }

  async function loadFlows() {
    setFlowsLoading(true)
    const r = await fetch('/api/merchant/flows')
    if (r.ok) setFlows(await r.json())
    setFlowsLoading(false)
  }

  async function createFlow() {
    setCreatingFlow(true)
    const r = await fetch('/api/merchant/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Flow', trigger: 'signup' }) })
    const d = await r.json()
    setCreatingFlow(false)
    if (d.id) router.push(`/merchant/flows/${d.id}`)
  }

  async function deleteFlow(id: string) {
    await fetch(`/api/merchant/flows?id=${id}`, { method: 'DELETE' })
    setFlows(prev => prev.filter(f => f.id !== id))
  }

  async function toggleFlow(id: string, active: boolean) {
    await fetch('/api/merchant/flows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active }) })
    setFlows(prev => prev.map(f => f.id === id ? { ...f, active } : f))
  }

  async function sendCampaign() {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.body) { setCampaignMsg('Fill in all fields.'); return }
    setCampaignSending(true); setCampaignMsg('')
    const r = await fetch('/api/merchant/campaigns/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCampaign, emailBody: newCampaign.body }) })
    const d = await r.json()
    if (!r.ok) { setCampaignMsg(d.error || 'Failed to send.'); setCampaignSending(false); return }
    setCampaignMsg(`✓ Sent to ${d.sent} customers!`)
    setCampaigns(prev => [d.campaign, ...prev])
    setNewCampaign({ name: '', subject: '', body: '', segment: 'all' })
    setCampaignSending(false)
  }

  async function deleteCampaign(id: string) {
    await fetch(`/api/merchant/campaigns?id=${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  async function addAutomation() {
    if (!newAutomation.name || !newAutomation.subject || !newAutomation.body) return
    const r = await fetch('/api/merchant/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAutomation) })
    const d = await r.json()
    if (!d.error) { setAutomations(prev => [d, ...prev]); setNewAutomation({ trigger: 'signup', name: '', subject: '', body: '' }); setShowAutoForm(false) }
  }

  async function toggleAutomation(id: string, active: boolean) {
    await fetch('/api/merchant/automations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active }) })
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active } : a))
  }

  async function deleteAutomation(id: string) {
    await fetch(`/api/merchant/automations?id=${id}`, { method: 'DELETE' })
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    const [ar, sr] = await Promise.all([
      fetch('/api/merchant/analytics'),
      fetch('/api/merchant/analytics/segments'),
    ])
    if (ar.ok) setAnalytics(await ar.json())
    if (sr.ok) setSegments(await sr.json())
    setAnalyticsLoading(false)
  }

  async function openDrawer(type: string, period = '30') {
    setDrawer({ type, data: [], loading: true, period })
    const url = type.startsWith('segment:')
      ? `/api/merchant/analytics/detail?type=segment&segment=${type.slice(8)}`
      : `/api/merchant/analytics/detail?type=${type}&period=${period}`
    const r = await fetch(url)
    setDrawer({ type, data: r.ok ? await r.json() : [], loading: false, period })
  }

  async function changeDrawerPeriod(period: string) {
    if (!drawer.type || drawer.type.startsWith('segment:')) return
    const type = drawer.type
    setDrawer(prev => ({ ...prev, data: [], loading: true, period }))
    const r = await fetch(`/api/merchant/analytics/detail?type=${type}&period=${period}`)
    const data = r.ok ? await r.json() : []
    setDrawer(prev => ({ ...prev, data, loading: false, period }))
  }

  function closeDrawer() { setDrawer({ type: null, data: [], loading: false, period: '30' }) }

  async function sendAiMessage() {
    const msg = aiChat.input.trim()
    if (!msg || aiChat.loading) return

    // Build context from whatever is currently visible on screen
    let pageContext = `Merchant is on the "${tab}" tab.`
    if (tab === 'overview' && analytics) {
      pageContext += ` They can see: ${analytics.totalCustomers} total members, ${analytics.totalPointsIssued.toLocaleString()} pts issued (30d), ${analytics.totalPointsRedeemed.toLocaleString()} pts redeemed (30d), ${analytics.totalRedemptions} redemptions (30d).`
      if (analytics.topCustomers.length) pageContext += ` Top customer: ${analytics.topCustomers[0].name} with ${analytics.topCustomers[0].points} pts (${analytics.topCustomers[0].tier}).`
      if (analytics.recentActivity.length) pageContext += ` Most recent activity: ${analytics.recentActivity[0].customerName} ${analytics.recentActivity[0].points > 0 ? 'earned' : 'redeemed'} ${Math.abs(analytics.recentActivity[0].points)} pts.`
    } else if (tab === 'customers' && customers.length > 0) {
      pageContext += ` Viewing ${customers.length} customers. First few: ${customers.slice(0, 3).map(c => `${c.name} (${c.points} pts, ${c.tier})`).join(', ')}.`
    } else if (tab === 'offers' && offers.length > 0) {
      pageContext += ` Viewing ${offers.length} offers: ${offers.map((o: any) => `${o.name} (${o.points_required} pts)`).join(', ')}.`
    } else if (tab === 'settings' && merchant) {
      pageContext += ` Viewing settings: color ${merchant.widget_primary_color}, position ${merchant.widget_position}, ${merchant.points_per_dollar} pts/$1, ${merchant.signup_bonus} pt sign-up bonus.`
    }

    const newMessages: { role: 'user' | 'ai'; content: string }[] = [...aiChat.messages, { role: 'user', content: msg }]
    setAiChat(p => ({ ...p, messages: newMessages, input: '', loading: true }))
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    const r = await fetch('/api/merchant/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: aiChat.messages, pageContext }),
    })
    const d = r.ok ? await r.json() : { reply: 'Something went wrong. Try again.' }
    setAiChat(p => ({ ...p, messages: [...newMessages, { role: 'ai', content: d.reply || d.error }], loading: false }))
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function saveSettings() {
    if (!merchant) return
    setSaving(true)
    await fetch('/api/merchant/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merchant) })
    setSaving(false)
    alert('Settings saved!')
  }

  async function addOffer() {
    const r = await fetch('/api/merchant/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOffer) })
    const data = await r.json()
    if (!data.error) { setOffers(prev => [...prev, data]); setNewOffer({ name: '', description: '', points_required: 500, offer_type: 'percentage', offer_value: '10', min_tier: 'Bronze' }) }
  }

  async function deleteOffer(id: string) {
    await fetch(`/api/merchant/offers?id=${id}`, { method: 'DELETE' })
    setOffers(prev => prev.filter(o => o.id !== id))
  }

  function connectShopify() {
    if (!connectDomain || !merchant) return
    setConnecting(true)
    const domain = connectDomain.includes('.myshopify.com') ? connectDomain : `${connectDomain}.myshopify.com`
    window.location.href = `/api/auth/install?shop=${domain}&merchant_id=${merchant.id}`
  }

  async function logout() {
    await fetch('/api/merchant/me', { method: 'DELETE' })
    router.push('/')
  }

  const isConnected = merchant && merchant.shopify_domain && merchant.shopify_access_token !== 'pending'
  const widgetSnippet = `{% if customer %}\n<script src="https://goldpoints-shopify.vercel.app/widget.js"\n  data-shop="{{ shop.permanent_domain }}"\n  data-customer-email="{{ customer.email }}"\n  data-customer-name="{{ customer.first_name }} {{ customer.last_name }}"></script>\n{% else %}\n<script src="https://goldpoints-shopify.vercel.app/widget.js"\n  data-shop="{{ shop.permanent_domain }}"></script>\n{% endif %}`

  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>
  if (!merchant) return null

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="bg-gradient-to-r from-purple-700 to-purple-500 px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">Gold<span className="text-yellow-400">Points</span></span>
          <span className="text-sm bg-white/20 rounded-full px-3 py-1">{merchant.store_name}</span>
        </div>
        <button onClick={logout} className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition">Sign Out</button>
      </header>

      {/* Connect Shopify banner */}
      {!isConnected && (
        <div className="bg-yellow-900/40 border-b border-yellow-500/30 px-8 py-4">
          <p className="text-yellow-300 text-sm font-semibold mb-3">⚠️ Connect your Shopify store to activate the widget and start tracking orders</p>
          <div className="flex gap-3 items-center flex-wrap">
            <input value={connectDomain} onChange={e => setConnectDomain(e.target.value)} placeholder="yourstore.myshopify.com" onKeyDown={e => e.key === 'Enter' && connectShopify()} className="bg-[#0f0f1a] border border-yellow-500/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-400 w-64" />
            <button onClick={connectShopify} disabled={connecting} className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-bold px-5 py-2 rounded-lg transition">
              {connecting ? 'Connecting...' : 'Connect with Shopify →'}
            </button>
          </div>
        </div>
      )}

      <nav className="flex items-center justify-between px-8 py-3 bg-[#16162a] border-b border-white/10">
        <div className="flex gap-2 flex-wrap">
          {(['overview','customers','offers','campaigns','flows','settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm capitalize transition ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => setAiChat(p => ({ ...p, open: true }))} className="flex items-center gap-1.5 bg-gradient-to-r from-purple-700 to-indigo-600 hover:opacity-90 px-4 py-2 rounded-full text-sm font-semibold transition shrink-0 ml-4">
          <span>✦</span> AI
        </button>
      </nav>

      <main className={`p-8 max-w-5xl mx-auto transition-all duration-300 ${aiChat.open ? 'mr-[420px]' : ''}`}>
        {tab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-purple-400">Dashboard</h2>
            {analyticsLoading && <p className="text-gray-500 text-sm">Loading analytics...</p>}
            {analytics && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Members', value: analytics.totalCustomers.toLocaleString(), color: 'text-purple-400', dt: null },
                    { label: 'Points Issued (30d)', value: analytics.totalPointsIssued.toLocaleString(), color: 'text-yellow-400', dt: 'points' },
                    { label: 'Points Redeemed (30d)', value: analytics.totalPointsRedeemed.toLocaleString(), color: 'text-green-400', dt: null },
                    { label: 'Redemptions (30d)', value: analytics.totalRedemptions.toLocaleString(), color: 'text-blue-400', dt: 'redemptions' },
                  ].map(({ label, value, color, dt }) => (
                    <div key={label} onClick={() => dt && openDrawer(dt)} className={`bg-[#16162a] border border-white/10 rounded-xl p-4 text-center ${dt ? 'cursor-pointer hover:border-white/30 transition' : ''}`}>
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                      {dt && <div className="text-xs text-gray-600 mt-1">View details →</div>}
                    </div>
                  ))}
                </div>

                {/* Campaign Revenue Attribution */}
                {(analytics.campaignRevenue > 0 || analytics.campaignOrders > 0) && (
                  <div className="bg-[#16162a] border border-emerald-500/20 rounded-xl px-5 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Campaign-Attributed Revenue (30d)</div>
                      <div className="text-sm text-gray-400 max-w-xs">Revenue from orders placed within 7 days of a customer receiving a campaign email.</div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 ml-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">${analytics.campaignRevenue.toFixed(2)}</div>
                        <div className="text-xs text-gray-600">revenue driven</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-300">{analytics.campaignOrders}</div>
                        <div className="text-xs text-gray-600">orders</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Points Liability */}
                <div className="bg-[#16162a] border border-rose-500/20 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Points Liability</div>
                    <div className="text-sm text-gray-400 max-w-xs">Total unredeemed points outstanding across all your members — your current reward obligation.</div>
                  </div>
                  <div className="text-right shrink-0 ml-6">
                    <div className="text-2xl font-bold text-rose-400">{analytics.totalPointsLiability.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">pts owed</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BarChart title="Points Issued — Last 14 Days" data={analytics.pointsChart} color="#a78bfa" />
                  <BarChart title="New Signups — Last 14 Days" data={analytics.signupsChart} color="#fbbf24" onSeeAll={() => openDrawer('signups')} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-4">
                    <div className="text-sm font-semibold text-gray-300 mb-3">Top Customers</div>
                    <div className="space-y-2">
                      {analytics.topCustomers.length === 0 ? (
                        <p className="text-xs text-gray-600">No customers yet.</p>
                      ) : analytics.topCustomers.map((c, i) => (
                        <div key={c.email} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}.</span>
                            <span className="text-sm text-white truncate">{c.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${c.tier === 'Gold' ? 'bg-yellow-900 text-yellow-400' : c.tier === 'Silver' ? 'bg-gray-700 text-gray-300' : 'bg-orange-900 text-orange-400'}`}>{c.tier}</span>
                          </div>
                          <span className="text-sm text-purple-400 font-bold shrink-0">{c.points.toLocaleString()} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-300">Recent Activity</div>
                      <button onClick={() => openDrawer('activity')} className="text-xs text-gray-500 hover:text-white transition">See all →</button>
                    </div>
                    <div className="space-y-2">
                      {analytics.recentActivity.length === 0 ? (
                        <p className="text-xs text-gray-600">No activity yet.</p>
                      ) : analytics.recentActivity.map((a, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-white truncate">{a.customerName}</div>
                            <div className="text-xs text-gray-500 truncate">{a.description || a.type}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-bold ${a.points > 0 ? 'text-green-400' : 'text-red-400'}`}>{a.points > 0 ? '+' : ''}{a.points}</div>
                            <div className="text-xs text-gray-600">{new Date(a.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Tier Breakdown + Offer Performance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-5">
                    <div className="text-sm font-semibold text-gray-300 mb-4">Tier Breakdown</div>
                    <TierBreakdown tiers={analytics.tierBreakdown} total={analytics.totalCustomers} />
                  </div>
                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-5">
                    <div className="text-sm font-semibold text-gray-300 mb-4">Offer Performance</div>
                    {analytics.offerPerformance.length === 0 ? (
                      <p className="text-xs text-gray-600">No redemptions yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {analytics.offerPerformance.map(o => (
                          <div key={o.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-white truncate max-w-[70%]">{o.name}</span>
                              <span className="text-xs text-gray-400 shrink-0 ml-2">{o.count} × · {o.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${o.pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Health */}
                {segments && segments.total > 0 && (
                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-5">
                    <div className="text-sm font-semibold text-gray-300 mb-5">Customer Health</div>
                    <div className="flex gap-6 items-center">
                      <DonutChart segments={segments.segments} total={segments.total} />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        {SEGMENT_CONFIG.map(s => {
                          const seg = segments.segments[s.key]
                          const count = seg?.count || 0
                          const pct = seg?.pct || 0
                          return (
                            <button
                              key={s.key}
                              onClick={() => count > 0 && openDrawer(`segment:${s.key}`)}
                              className={`text-left px-3 py-2 rounded-xl border transition ${count > 0 ? 'border-white/10 hover:border-white/25 cursor-pointer' : 'border-white/5 opacity-40 cursor-default'} bg-[#0f0f1a]`}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-xs text-gray-400 truncate">{s.label}</span>
                              </div>
                              <div className="text-base font-bold text-white">{count} <span className="text-xs font-normal text-gray-600">({pct}%)</span></div>
                              <div className="text-[10px] text-gray-600 mt-0.5">{s.days}</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-purple-400">Customers ({customers.length})</h2>
              <div className="flex gap-1.5">
                {(['All', 'Bronze', 'Silver', 'Gold'] as const).map(t => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tierFilter === t
                      ? t === 'Gold' ? 'bg-yellow-500 text-black' : t === 'Silver' ? 'bg-gray-400 text-black' : t === 'Bronze' ? 'bg-orange-500 text-black' : 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {customers.length === 0 ? <p className="text-gray-500">No customers yet. They register through your Shopify widget.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-[#1f1f3a]"><tr>{['Name','Email','Points','Tier','Joined'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>{customers.filter((c: any) => tierFilter === 'All' || c.tier === tierFilter).map((c: any) => (
                  <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-400">{c.email}</td>
                    <td className="px-4 py-3 text-purple-400 font-bold">{c.points}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${c.tier==='Gold'?'bg-yellow-900 text-yellow-400':c.tier==='Silver'?'bg-gray-700 text-gray-300':'bg-orange-900 text-orange-400'}`}>{c.tier}</span></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'offers' && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Offers & Rewards</h2>
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="font-semibold mb-4">Add New Offer</h3>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Offer name (e.g. 10% Off)" value={newOffer.name} onChange={e => setNewOffer(p => ({...p, name: e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Description" value={newOffer.description} onChange={e => setNewOffer(p => ({...p, description: e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Points required" value={newOffer.points_required} onChange={e => setNewOffer(p => ({...p, points_required: +e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                <select value={newOffer.offer_type} onChange={e => setNewOffer(p => ({...p, offer_type: e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="percentage">% Discount</option>
                  <option value="shipping">Free Shipping</option>
                  <option value="fixed">Fixed $ Off</option>
                </select>
                <input placeholder="Value (e.g. 10 for 10%)" value={newOffer.offer_value} onChange={e => setNewOffer(p => ({...p, offer_value: e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                <select value={newOffer.min_tier} onChange={e => setNewOffer(p => ({...p, min_tier: e.target.value}))} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="Bronze">All tiers (Bronze+)</option>
                  <option value="Silver">🥈 Silver+ only</option>
                  <option value="Gold">🥇 Gold only</option>
                </select>
              </div>
              <button onClick={addOffer} className="mt-4 bg-purple-600 hover:bg-purple-500 px-5 py-2 rounded-lg text-sm font-semibold">Add Offer</button>
            </div>
            <div className="space-y-3">{offers.map((o: any) => (
              <div key={o.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {o.name}
                    {o.min_tier && o.min_tier !== 'Bronze' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.min_tier === 'Gold' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-700/40 text-gray-300'}`}>
                        {o.min_tier === 'Gold' ? '🥇' : '🥈'} {o.min_tier}+ only
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">{o.description} · <span className="text-purple-400">{o.points_required} pts</span> · {o.offer_type === 'shipping' ? 'Free Shipping' : `${o.offer_value}${o.offer_type==='percentage'?'% off':'$ off'}`}</div>
                </div>
                <button onClick={() => deleteOffer(o.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
              </div>
            ))}</div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-purple-400">Campaigns</h2>

            {/* Send Campaign */}
            <div>
              <h3 className="text-base font-semibold text-gray-200 mb-4">Email Campaign</h3>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Campaign name (internal)</label>
                    <input value={newCampaign.name} onChange={e => setNewCampaign(p => ({...p, name: e.target.value}))} placeholder="e.g. Summer promo" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Segment</label>
                    <select value={newCampaign.segment} onChange={e => setNewCampaign(p => ({...p, segment: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <option value="all">All Customers</option>
                      <option value="Bronze">🥉 Bronze Tier</option>
                      <option value="Silver">🥈 Silver Tier</option>
                      <option value="Gold">🥇 Gold Tier</option>
                      <option value="active">🛍️ Active (last 30d)</option>
                      <option value="at_risk">⚠️ At Risk (31–60d)</option>
                      <option value="dormant">💤 Dormant (61–90d)</option>
                      <option value="never">🆕 Never Purchased</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subject line</label>
                  <input value={newCampaign.subject} onChange={e => setNewCampaign(p => ({...p, subject: e.target.value}))} placeholder="You have rewards waiting 🎁" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email body</label>
                  <p className="text-xs text-gray-600 mb-1">Personalize with: <span className="text-purple-400">{'{{name}}'}</span>, <span className="text-purple-400">{'{{points}}'}</span>, <span className="text-purple-400">{'{{tier}}'}</span>, <span className="text-purple-400">{'{{store}}'}</span></p>
                  <textarea value={newCampaign.body} onChange={e => setNewCampaign(p => ({...p, body: e.target.value}))} rows={5} placeholder={'Hi {{name}},\n\nYou have {{points}} loyalty points waiting. Come back and use them!\n\n— {{store}}'} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm resize-y" />
                </div>
                {campaignMsg && <p className={`text-sm font-medium ${campaignMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{campaignMsg}</p>}
                <button onClick={sendCampaign} disabled={campaignSending} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-semibold">
                  {campaignSending ? 'Sending...' : '✉️ Send Campaign'}
                </button>
              </div>
            </div>

            {/* Campaign History */}
            {campaigns.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-200 mb-4">Campaign History</h3>
                <div className="space-y-3">
                  {campaigns.map(c => (
                    <div key={c.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">"{c.subject}" · {c.segment} · {c.recipient_count} recipients · {new Date(c.created_at).toLocaleDateString()}</div>
                        </div>
                        <button onClick={() => deleteCampaign(c.id)} className="text-red-400 hover:text-red-300 text-sm shrink-0">Remove</button>
                      </div>
                      {(c.attributed_orders > 0 || c.attributed_revenue > 0) && (
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-xs text-gray-400">{c.attributed_orders} attributed orders</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-xs font-semibold text-emerald-400">${c.attributed_revenue.toFixed(2)} revenue</span>
                          </div>
                          <div className="text-xs text-gray-600">within 7 days of send</div>
                        </div>
                      )}
                      {c.attributed_orders === 0 && c.recipient_count > 0 && (
                        <div className="mt-2 text-xs text-gray-600">No attributed orders yet · tracking 7-day window</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Automations */}
            <div>
              <h3 className="text-base font-semibold text-gray-200 mb-1">Automations</h3>
              <p className="text-xs text-gray-500 mb-4">Automatically email customers when they hit milestones. Supports <span className="text-purple-400">{'{{name}}'}</span>, <span className="text-purple-400">{'{{points}}'}</span>, <span className="text-purple-400">{'{{tier}}'}</span>, <span className="text-purple-400">{'{{store}}'}</span>.</p>
              <div className="space-y-3 mb-4">
                {automations.map(a => (
                  <div key={a.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => toggleAutomation(a.id, !a.active)}
                        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${a.active ? 'bg-purple-600' : 'bg-gray-700'}`}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${a.active ? 'left-5' : 'left-1'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{a.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {a.trigger === 'signup' ? '🎉 New signup' : a.trigger === 'tier_silver' ? '🥈 Silver reached' : '🥇 Gold reached'} · "{a.subject}"
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deleteAutomation(a.id)} className="text-red-400 hover:text-red-300 text-sm shrink-0">Remove</button>
                  </div>
                ))}
                {automations.length === 0 && !showAutoForm && <p className="text-gray-600 text-sm">No automations yet.</p>}
              </div>
              {!showAutoForm && (
                <button onClick={() => setShowAutoForm(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm transition">+ Add Automation</button>
              )}
              {showAutoForm && (
                <div className="bg-[#16162a] border border-purple-500/30 rounded-xl p-6 space-y-4">
                  <h4 className="font-semibold text-sm text-gray-200">New Automation</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Trigger</label>
                      <select value={newAutomation.trigger} onChange={e => setNewAutomation(p => ({...p, trigger: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                        <option value="signup">🎉 New Customer Signup</option>
                        <option value="tier_silver">🥈 Customer reaches Silver</option>
                        <option value="tier_gold">🥇 Customer reaches Gold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Automation name</label>
                      <input value={newAutomation.name} onChange={e => setNewAutomation(p => ({...p, name: e.target.value}))} placeholder="e.g. Welcome email" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Subject</label>
                    <input value={newAutomation.subject} onChange={e => setNewAutomation(p => ({...p, subject: e.target.value}))} placeholder="Welcome to {{store}} rewards!" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email body</label>
                    <textarea value={newAutomation.body} onChange={e => setNewAutomation(p => ({...p, body: e.target.value}))} rows={4} placeholder={'Hi {{name}},\n\nWelcome to our loyalty program! You start with {{points}} points.\n\n— {{store}}'} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm resize-y" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={addAutomation} className="bg-purple-600 hover:bg-purple-500 px-5 py-2 rounded-lg text-sm font-semibold">Save Automation</button>
                    <button onClick={() => setShowAutoForm(false)} className="bg-white/5 hover:bg-white/10 px-5 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'flows' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-purple-400">Automation Flows</h2>
                <p className="text-sm text-gray-500 mt-1">Visual multi-step automations — drag and drop emails, waits, conditions, and more.</p>
              </div>
              <button onClick={createFlow} disabled={creatingFlow}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-semibold transition shrink-0">
                {creatingFlow ? 'Creating…' : '+ New Flow'}
              </button>
            </div>

            {flowsLoading && <p className="text-gray-500 text-sm">Loading flows…</p>}

            {!flowsLoading && flows.length === 0 && (
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-10 text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div className="text-gray-400 font-semibold mb-1">No flows yet</div>
                <div className="text-gray-600 text-sm mb-4">Create a visual multi-step automation — send emails, add waits, branch on conditions.</div>
                <button onClick={createFlow} disabled={creatingFlow}
                  className="bg-purple-600 hover:bg-purple-500 px-5 py-2 rounded-lg text-sm font-semibold">
                  {creatingFlow ? 'Creating…' : 'Create your first flow'}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {flows.map(f => {
                const triggerLabel: Record<string, string> = { signup: '🎉 New Signup', tier_silver: '🥈 Reaches Silver', tier_gold: '🥇 Reaches Gold', inactive_30: '💤 30-Day Inactive', birthday: '🎂 Birthday' }
                return (
                  <div key={f.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => toggleFlow(f.id, !f.active)}
                        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${f.active ? 'bg-purple-600' : 'bg-gray-700'}`}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${f.active ? 'left-5' : 'left-1'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{f.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{triggerLabel[f.trigger] || f.trigger} · {new Date(f.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => router.push(`/merchant/flows/${f.id}`)}
                        className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition">
                        Edit →
                      </button>
                      <button onClick={() => deleteFlow(f.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'settings' && merchant && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-purple-400">Settings</h2>

            {/* Widget */}
            <div>
              <h3 className="text-base font-semibold text-gray-200 mb-4">Widget</h3>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 space-y-4">
                <div><label className="block text-sm text-gray-400 mb-1">Widget Title</label><input value={merchant.widget_title || ''} onChange={e => setMerchant(p => p ? {...p, widget_title: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Button Color</label><input type="color" value={merchant.widget_primary_color || '#6c3fff'} onChange={e => setMerchant(p => p ? {...p, widget_primary_color: e.target.value} : p)} className="h-10 w-20 rounded cursor-pointer bg-transparent border-0" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Button Text Color</label><input type="color" value={merchant.widget_btn_text_color || '#ffffff'} onChange={e => setMerchant(p => p ? {...p, widget_btn_text_color: e.target.value} : p)} className="h-10 w-20 rounded cursor-pointer bg-transparent border-0" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Position</label>
                  <select value={merchant.widget_position || 'bottom-right'} onChange={e => setMerchant(p => p ? {...p, widget_position: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>
                <div><label className="block text-sm text-gray-400 mb-1">Vertical spacing (px)</label><input type="number" value={merchant.widget_offset_bottom ?? 24} onChange={e => setMerchant(p => p ? {...p, widget_offset_bottom: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-24" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Side spacing (px)</label><input type="number" value={merchant.widget_offset_side ?? 24} onChange={e => setMerchant(p => p ? {...p, widget_offset_side: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-24" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Points per $1 spent</label><input type="number" value={merchant.points_per_dollar || 1} onChange={e => setMerchant(p => p ? {...p, points_per_dollar: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Sign-up bonus points</label><input type="number" value={merchant.signup_bonus || 0} onChange={e => setMerchant(p => p ? {...p, signup_bonus: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Points Multiplier — how many times the base earn rate each tier receives on purchases.</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥉 Bronze multiplier</label>
                      <input type="number" step="0.1" value={merchant.tier_bronze_multiplier ?? 1.0} onChange={e => setMerchant(p => p ? {...p, tier_bronze_multiplier: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥈 Silver multiplier</label>
                      <input type="number" step="0.1" value={merchant.tier_silver_multiplier ?? 1.5} onChange={e => setMerchant(p => p ? {...p, tier_silver_multiplier: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥇 Gold multiplier</label>
                      <input type="number" step="0.1" value={merchant.tier_gold_multiplier ?? 2.0} onChange={e => setMerchant(p => p ? {...p, tier_gold_multiplier: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Tier Upgrade Bonus — one-time bonus points awarded the first time a customer reaches Silver or Gold.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥈 Silver upgrade bonus (pts)</label>
                      <input type="number" value={merchant.tier_silver_bonus ?? 0} onChange={e => setMerchant(p => p ? {...p, tier_silver_bonus: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" placeholder="0 = disabled" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥇 Gold upgrade bonus (pts)</label>
                      <input type="number" value={merchant.tier_gold_bonus ?? 0} onChange={e => setMerchant(p => p ? {...p, tier_gold_bonus: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" placeholder="0 = disabled" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Loyalty Tiers — minimum points to reach each tier. Changes apply to new transactions.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥈 Silver threshold (pts)</label>
                      <input type="number" value={merchant.tier_silver ?? 500} onChange={e => setMerchant(p => p ? {...p, tier_silver: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🥇 Gold threshold (pts)</label>
                      <input type="number" value={merchant.tier_gold ?? 1000} onChange={e => setMerchant(p => p ? {...p, tier_gold: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Referral Program — points awarded to the referrer when a friend joins.</p>
                  <div><label className="block text-sm text-gray-400 mb-1">Referral bonus points</label><input type="number" value={merchant.referral_points || 100} onChange={e => setMerchant(p => p ? {...p, referral_points: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Social Follow Reward — leave blank to hide it in the widget.</p>
                  <div><label className="block text-sm text-gray-400 mb-1">Social page URL</label><input value={merchant.social_follow_url || ''} onChange={e => setMerchant(p => p ? {...p, social_follow_url: e.target.value} : p)} placeholder="https://facebook.com/yourstore" className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" /></div>
                  <div className="mt-3"><label className="block text-sm text-gray-400 mb-1">Points for following</label><input type="number" value={merchant.follow_points || 50} onChange={e => setMerchant(p => p ? {...p, follow_points: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                </div>
                <button onClick={saveSettings} disabled={saving} className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save Settings'}</button>
              </div>
            </div>

            {/* Install */}
            <div>
              <h3 className="text-base font-semibold text-gray-200 mb-4">Install</h3>
              {!isConnected && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4 text-yellow-300 text-sm">
                  Connect your Shopify store first using the yellow banner above.
                </div>
              )}
              <div className="space-y-4">
                <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                  <h4 className="font-semibold mb-2">1. Copy this snippet</h4>
                  <pre className="bg-[#0f0f1a] p-4 rounded-lg text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">{widgetSnippet}</pre>
                  <button onClick={() => navigator.clipboard.writeText(widgetSnippet)} className="mt-3 text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg">Copy Code</button>
                </div>
                <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                  <h4 className="font-semibold mb-3">2. Add to your Shopify theme</h4>
                  <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                    <li>In Shopify Admin, go to <strong>Online Store → Themes</strong></li>
                    <li>Click <strong>Edit code</strong> on your active theme</li>
                    <li>Open <strong>theme.liquid</strong></li>
                    <li>Paste the snippet just before the <code className="text-purple-400">&lt;/body&gt;</code> tag</li>
                    <li>Save — the widget will appear on every page of your store</li>
                  </ol>
                </div>
                <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                  <h4 className="font-semibold mb-3">3. Set up the orders webhook</h4>
                  <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                    <li>In Shopify Admin, go to <strong>Settings → Notifications → Webhooks</strong></li>
                    <li>Click <strong>Create webhook</strong></li>
                    <li>Event: <strong>Order creation</strong>, Format: <strong>JSON</strong></li>
                    <li>URL: <code className="text-purple-400 break-all">https://goldpoints-shopify.vercel.app/api/webhooks/orders</code></li>
                    <li>Save</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Account */}
            <div>
              <h3 className="text-base font-semibold text-gray-200 mb-4">Account</h3>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 mb-4">
                <p className="text-sm text-gray-400 mb-1">Logged in as</p>
                <p className="font-semibold">{merchant.email}</p>
              </div>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 max-w-md">
                <h4 className="font-semibold mb-4">Change Password</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Current password</label>
                    <input type="password" value={currPw} onChange={e => setCurrPw(e.target.value)} placeholder="••••••••" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">New password</label>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  </div>
                  {pwMsg && <p className={`text-xs ${pwMsg.includes('changed') ? 'text-green-400' : 'text-red-400'}`}>{pwMsg}</p>}
                  <button disabled={pwSaving} onClick={async () => {
                    setPwSaving(true); setPwMsg('')
                    const r = await fetch('/api/merchant/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: currPw, new_password: newPw }) })
                    const d = await r.json()
                    if (!r.ok) { setPwMsg(d.error); } else { setPwMsg('Password changed successfully!'); setCurrPw(''); setNewPw('') }
                    setPwSaving(false)
                  }} className="w-full bg-gradient-to-r from-purple-700 to-purple-500 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">
                    {pwSaving ? 'Saving...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AI Chat Drawer */}
      {aiChat.open && (
        <>
          <div className="fixed right-0 top-0 h-full w-[420px] bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-purple-400">✦</span>
                <div>
                  <div className="font-semibold text-white text-sm">AI Assistant</div>
                  <div className="text-xs text-gray-500">Ask anything about your store</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aiChat.messages.length > 0 && (
                  <button onClick={() => setAiChat(p => ({ ...p, messages: [] }))} className="text-xs text-gray-600 hover:text-gray-400 transition">Clear</button>
                )}
                <button onClick={() => setAiChat(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {aiChat.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                  <div className="text-3xl text-purple-400/50">✦</div>
                  <p className="text-gray-500 text-sm text-center px-4">Ask me anything — insights, what to improve, how your top customers are doing, whether your offers are working...</p>
                  <div className="flex flex-col gap-2 w-full mt-2">
                    {['Give me insights on my store', 'How is my redemption rate?', 'Who are my best customers?', 'What should I improve?'].map(q => (
                      <button key={q} onClick={() => setAiChat(p => ({ ...p, input: q }))} className="text-xs text-left bg-[#0f0f1a] border border-white/10 hover:border-purple-500/50 text-gray-400 hover:text-white px-3 py-2 rounded-lg transition">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiChat.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-[#0f0f1a] border border-white/10 text-gray-200 rounded-bl-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiChat.loading && (
                <div className="flex justify-start">
                  <div className="bg-[#0f0f1a] border border-white/10 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                    <span className="text-purple-400 animate-pulse text-sm">✦ thinking...</span>
                  </div>
                </div>
              )}
              <div ref={aiEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-white/10 shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  value={aiChat.input}
                  onChange={e => setAiChat(p => ({ ...p, input: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage() } }}
                  placeholder="Ask about your store..."
                  rows={1}
                  className="flex-1 bg-[#0f0f1a] border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none resize-none"
                />
                <button onClick={sendAiMessage} disabled={aiChat.loading || !aiChat.input.trim()} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0">
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {drawer.type && (() => {
        const TYPE_LABEL: Record<string, string> = {
          earn_order: 'Purchase', earn_signup: 'Sign-up bonus', earn_referral: 'Referral',
          earn_follow: 'Social follow', earn_birthday: 'Birthday bonus',
          redeem: 'Redemption', deduct_cancel: 'Order cancelled',
        }
        const PERIODS = [{ v: '7', l: '7 days' }, { v: '30', l: '30 days' }, { v: '90', l: '90 days' }, { v: 'all', l: 'All time' }]
        const hasPeriod = drawer.type === 'points' || drawer.type === 'redemptions' || drawer.type === 'activity' || drawer.type === 'signups'
        const totalPts = drawer.type === 'points' ? drawer.data.reduce((s: number, t: any) => s + t.points, 0) : 0
        return (
          <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={closeDrawer} />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
              <div className="px-6 pt-4 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-white">
                    {drawer.type === 'points' && 'Points Issued'}
                    {drawer.type === 'redemptions' && 'Redemptions'}
                    {drawer.type === 'signups' && 'New Signups'}
                    {drawer.type === 'activity' && 'All Activity'}
                    {drawer.type?.startsWith('segment:') && (() => { const s = SEGMENT_CONFIG.find(x => x.key === drawer.type!.slice(8)); return s ? `${s.label} Customers` : 'Customers' })()}
                  </div>
                  <button onClick={closeDrawer} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
                </div>
                {hasPeriod && (
                  <div className="flex gap-1">
                    {PERIODS.map(p => (
                      <button key={p.v} onClick={() => changeDrawerPeriod(p.v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${drawer.period === p.v ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!drawer.loading && drawer.data.length > 0 && (drawer.type === 'points' || drawer.type === 'signups' || drawer.type?.startsWith('segment:')) && (
                <div className="px-6 py-3 bg-[#0f0f1a] border-b border-white/5 flex items-center justify-between shrink-0">
                  {drawer.type === 'points' && (<><span className="text-xs text-gray-500">{drawer.data.length} transactions</span><span className="text-sm font-bold text-yellow-400">+{totalPts.toLocaleString()} pts total</span></>)}
                  {drawer.type === 'signups' && (<><span className="text-xs text-gray-500">New members</span><span className="text-sm font-bold text-purple-400">{drawer.data.length} joined</span></>)}
                  {drawer.type?.startsWith('segment:') && (() => { const s = SEGMENT_CONFIG.find(x => x.key === drawer.type!.slice(8)); return (<><span className="text-xs text-gray-500">{s?.label}</span><span className="text-sm font-bold" style={{ color: s?.color }}>{drawer.data.length} customers</span></>); })()}
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6">
                {drawer.loading ? (
                  <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>
                ) : drawer.data.length === 0 ? (
                  <p className="text-gray-600 text-sm py-8 text-center">No data for this period.</p>
                ) : (drawer.type === 'points' || drawer.type === 'activity') ? (
                  drawer.data.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">{item.customerName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {TYPE_LABEL[item.type] || item.type}{item.description ? ` · ${item.description}` : ''} · {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ml-3 ${item.points > 0 ? 'text-yellow-400' : 'text-red-400'}`}>{item.points > 0 ? '+' : ''}{item.points} pts</div>
                    </div>
                  ))
                ) : drawer.type === 'redemptions' ? (
                  drawer.data.map((item: any, i: number) => (
                    <div key={i} className="py-3 border-b border-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{item.customerName}</div>
                          <div className="text-xs text-gray-500 truncate">{item.customerEmail}</div>
                          <div className="text-xs text-purple-400 mt-1">{item.offerName} · {item.pointsRequired} pts spent</div>
                          <div className="text-xs text-gray-600 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                        <div
                          className="text-xs font-mono text-green-400 bg-green-900/30 px-2 py-1 rounded cursor-pointer hover:bg-green-900/50 transition shrink-0"
                          onClick={() => navigator.clipboard.writeText(item.discount_code)}
                          title="Click to copy"
                        >{item.discount_code}</div>
                      </div>
                    </div>
                  ))
                ) : drawer.type === 'signups' ? (
                  drawer.data.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{item.name}</div>
                        <div className="text-xs text-gray-400 truncate">{item.email}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${item.tier === 'Gold' ? 'bg-yellow-900 text-yellow-400' : item.tier === 'Silver' ? 'bg-gray-700 text-gray-300' : 'bg-orange-900 text-orange-400'}`}>{item.tier}</span>
                        <div className="text-xs text-purple-400 mt-1">{item.points?.toLocaleString()} pts</div>
                      </div>
                    </div>
                  ))
                ) : drawer.type?.startsWith('segment:') ? (
                  drawer.data.map((item: any, i: number) => {
                    const segKey = drawer.type!.slice(8)
                    const segConf = SEGMENT_CONFIG.find(x => x.key === segKey)
                    return (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{item.name}</div>
                          <div className="text-xs text-gray-400 truncate">{item.email}</div>
                          {item.lastPurchase
                            ? <div className="text-xs text-gray-600 mt-0.5">Last purchase {item.daysSince}d ago · {new Date(item.lastPurchase).toLocaleDateString()}</div>
                            : <div className="text-xs text-gray-600 mt-0.5">No purchase · joined {new Date(item.created_at).toLocaleDateString()}</div>
                          }
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${item.tier === 'Gold' ? 'bg-yellow-900 text-yellow-400' : item.tier === 'Silver' ? 'bg-gray-700 text-gray-300' : 'bg-orange-900 text-orange-400'}`}>{item.tier}</span>
                          <div className="text-xs mt-1 font-semibold" style={{ color: segConf?.color }}>{item.points?.toLocaleString()} pts</div>
                        </div>
                      </div>
                    )
                  })
                ) : null}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

export default function MerchantDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>}>
      <MerchantDashboardInner />
    </Suspense>
  )
}
