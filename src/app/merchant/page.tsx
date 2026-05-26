'use client'
import { useEffect, useState, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Merchant { id: string; store_name: string; shopify_domain: string; shopify_access_token: string; email: string; widget_primary_color: string; widget_gradient_color: string; widget_btn_text_color: string; widget_title: string; widget_position: string; widget_offset_bottom: number; widget_offset_side: number; widget_store_country: string; widget_phone_required: boolean; points_per_dollar: number; signup_bonus: number; social_follow_url: string; follow_points: number; referral_points: number; tier_silver: number; tier_gold: number; tier_bronze_multiplier: number; tier_silver_multiplier: number; tier_gold_multiplier: number; tier_silver_bonus: number; tier_gold_bonus: number; whatsapp_credits: number; is_premium: boolean; whatsapp_waba_id: string | null }
interface WaTemplate { id: string; name: string; category: string; body: string; status: string; rejection_reason: string | null; created_at: string }
interface Stats { customers: number; total_points: number; gold: number; silver: number; bronze: number }
interface Campaign { id: string; name: string; subject: string; body: string; segment: string; recipient_count: number; created_at: string; sent_at: string; attributed_orders: number; attributed_revenue: number; link_clicks: number; revenue_per_email: number; open_count: number; open_rate: number }
interface FlowSummary { id: string; name: string; trigger: string; active: boolean; created_at: string; enrolled: number; active_enrollments: number; completed_enrollments: number; error_enrollments: number }
interface Analytics {
  totalCustomers: number; totalPointsIssued: number; totalPointsRedeemed: number; totalRedemptions: number
  totalPointsLiability: number; campaignRevenue: number; campaignOrders: number; flowEmailRevenue: number; flowWhatsappRevenue: number
  activeFlowsCount: number
  recentCampaigns: { id: string; name: string; recipient_count: number; created_at: string; attributed_revenue: number; attributed_orders: number; link_clicks: number }[]
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
  const [tab, setTab] = useState<'overview' | 'customers' | 'offers' | 'settings' | 'campaigns' | 'flows' | 'whatsapp'>(() => {
    const t = searchParams.get('tab')
    if (t === 'flows' || t === 'campaigns' || t === 'offers' || t === 'customers' || t === 'settings' || t === 'whatsapp') return t
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
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([])
  const [waLoading, setWaLoading] = useState(false)
  const [waSyncing, setWaSyncing] = useState(false)
  const [waForm, setWaForm] = useState({ name: '', category: 'MARKETING', body: '' })
  const [waSubmitting, setWaSubmitting] = useState(false)
  const [waMsg, setWaMsg] = useState('')
  const [waConnecting, setWaConnecting] = useState(false)
  const [waConnectMsg, setWaConnectMsg] = useState('')
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [drawer, setDrawer] = useState<{ type: string | null; data: any[]; loading: boolean; period: string }>({ type: null, data: [], loading: false, period: '30' })
  const [segments, setSegments] = useState<any>(null)
  const [campaignDetail, setCampaignDetail] = useState<Campaign | null>(null)
  const [campaignSort, setCampaignSort] = useState<'recent' | 'revenue_high' | 'revenue_low' | 'clicks'>('recent')
  const [flowDetail, setFlowDetail] = useState<FlowSummary | null>(null)
  const [flowAnalytics, setFlowAnalytics] = useState<{ total: number; active: number; completed: number; error: number; trend: { date: string; value: number }[]; email_sends: number; whatsapp_sends: number; email_revenue: number; whatsapp_revenue: number } | null>(null)
  const [flowPeriod, setFlowPeriod] = useState('30')
  const [flowTest, setFlowTest] = useState<{ email: string; running: boolean; log: string[] }>({ email: '', running: false, log: [] })
  const [tierFilter, setTierFilter] = useState<'All' | 'Bronze' | 'Silver' | 'Gold'>('All')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDetail, setCustomerDetail] = useState<any | null>(null)
  const [customerDetailHistory, setCustomerDetailHistory] = useState<any[]>([])
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false)
  const [customerDetailEdits, setCustomerDetailEdits] = useState<{ name: string; phone: string; birthday: string; pointsAdjust: string }>({ name: '', phone: '', birthday: '', pointsAdjust: '0' })
  const [customerDetailSaving, setCustomerDetailSaving] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [addCustomerForm, setAddCustomerForm] = useState({ name: '', email: '', phone: '', birthday: '', points: '0' })
  const [addCustomerSaving, setAddCustomerSaving] = useState(false)
  const [addCustomerMsg, setAddCustomerMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [flowsLoading, setFlowsLoading] = useState(false)
  const [creatingFlow, setCreatingFlow] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', subject: '', body: '', segment: 'all', bonusPoints: 0 })
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignMsg, setCampaignMsg] = useState('')
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
    if (tab === 'overview') { loadAnalytics(); loadCampaigns(); loadFlows() }
    if (tab === 'campaigns') { loadCampaigns() }
    if (tab === 'flows') loadFlows()
    if (tab === 'whatsapp') loadWaTemplates()
  }, [tab])

  useEffect(() => {
    setFlowTest({ email: '', running: false, log: [] })
    if (!flowDetail) { setFlowAnalytics(null); return }
    fetch(`/api/merchant/flows?id=${flowDetail.id}&analytics=1&period=${flowPeriod}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.analytics) setFlowAnalytics(d.analytics) })
      .catch(() => {})
  }, [flowDetail?.id, flowPeriod])

  async function loadWaTemplates() {
    setWaLoading(true)
    const r = await fetch('/api/merchant/whatsapp-templates')
    if (r.ok) setWaTemplates(await r.json())
    setWaLoading(false)
  }

  function connectWhatsApp() {
    const fb = (window as any).FB
    if (!fb) {
      // Load FB SDK if not yet loaded
      const script = document.createElement('script')
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.async = true
      script.onload = () => {
        fb?.init?.({ appId: '1641237980517889', version: 'v18.0', xfbml: false, autoLogAppEvents: false })
        setTimeout(connectWhatsApp, 500)
      }
      document.head.appendChild(script)
      return
    }

    setWaConnecting(true)
    setWaConnectMsg('')

    let wabaId = ''
    let phoneNumberId = ''

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          wabaId = data.data.waba_id
          phoneNumberId = data.data.phone_number_id
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage)

    fb.login(async (response: any) => {
      window.removeEventListener('message', handleMessage)
      const code = response.authResponse?.code
      if (!code) {
        setWaConnectMsg('Connection cancelled.')
        setWaConnecting(false)
        return
      }
      try {
        const r = await fetch('/api/merchant/whatsapp-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, waba_id: wabaId, phone_number_id: phoneNumberId }),
        })
        const d = await r.json()
        if (r.ok) {
          setWaConnectMsg('✓ WhatsApp connected!')
          const m = await fetch('/api/merchant/me')
          const md = await m.json()
          if (!md.error) setMerchant(md)
        } else {
          setWaConnectMsg(`Error: ${d.error || 'Connection failed'}`)
        }
      } catch {
        setWaConnectMsg('Connection failed. Please try again.')
      }
      setWaConnecting(false)
    }, {
      config_id: 'trnm2002',
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureName: 'whatsapp_embedded_signup', sessionInfoVersion: '3' },
    })
  }

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
    setNewCampaign({ name: '', subject: '', body: '', segment: 'all', bonusPoints: 0 })
    setCampaignSending(false)
  }

  async function deleteCampaign(id: string) {
    await fetch(`/api/merchant/campaigns?id=${id}`, { method: 'DELETE' })
    setCampaigns(prev => prev.filter(c => c.id !== id))
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
          {(['overview','customers','offers','campaigns','flows'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm capitalize transition ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{t}</button>
          ))}
          <button onClick={() => setTab('whatsapp')} className={`px-4 py-2 rounded-full text-sm transition flex items-center gap-1.5 ${tab === 'whatsapp' ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
            💬 WhatsApp {!merchant?.is_premium && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">PRO</span>}
          </button>
          <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-full text-sm capitalize transition ${tab === 'settings' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>settings</button>
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

                {/* Flow Revenue */}
                {((analytics.flowEmailRevenue ?? 0) > 0 || (analytics.flowWhatsappRevenue ?? 0) > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#16162a] border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">${(analytics.flowEmailRevenue ?? 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Flow Email Revenue (30d)</div>
                    </div>
                    <div className="bg-[#16162a] border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">${(analytics.flowWhatsappRevenue ?? 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Flow WhatsApp Revenue (30d)</div>
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

                {/* Campaigns */}
                {campaigns.length > 0 && (() => {
                  const sorted = [...campaigns].sort((a, b) => {
                    if (campaignSort === 'revenue_high') return b.attributed_revenue - a.attributed_revenue
                    if (campaignSort === 'revenue_low') return a.attributed_revenue - b.attributed_revenue
                    if (campaignSort === 'clicks') return b.link_clicks - a.link_clicks
                    return new Date(b.created_at || b.sent_at || 0).getTime() - new Date(a.created_at || a.sent_at || 0).getTime()
                  })
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="text-sm font-semibold text-gray-300">Campaigns</div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {([
                              { v: 'recent', l: 'Recent' },
                              { v: 'revenue_high', l: 'Top Revenue' },
                              { v: 'revenue_low', l: 'Lowest' },
                              { v: 'clicks', l: 'Most Clicks' },
                            ] as const).map(s => (
                              <button key={s.v} onClick={() => setCampaignSort(s.v)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${campaignSort === s.v ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                                {s.l}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setTab('campaigns')} className="text-xs text-gray-500 hover:text-white transition">View all →</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sorted.map(c => {
                          const ctr = c.recipient_count > 0 ? ((c.link_clicks / c.recipient_count) * 100).toFixed(1) : '0.0'
                          return (
                            <button key={c.id} onClick={() => setCampaignDetail(c)}
                              className="bg-[#16162a] border border-white/10 hover:border-emerald-500/40 rounded-xl p-4 text-left transition group w-full">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition">{c.name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">{new Date(c.created_at || c.sent_at).toLocaleDateString()}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-bold text-emerald-400">${c.attributed_revenue.toFixed(2)}</div>
                                  <div className="text-xs text-gray-600">revenue</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">📧 {c.recipient_count.toLocaleString()}</span>
                                {(c.open_rate ?? 0) > 0 && <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">👁 {c.open_rate}%</span>}
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">👆 {c.link_clicks} · {ctr}%</span>
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">🛒 {c.attributed_orders}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Automation Flows */}
                {flows.length > 0 && (() => {
                  const TRIGGER_LABELS: Record<string, string> = {
                    signup: '🎉 New Signup', first_purchase: '🛍️ First Purchase',
                    tier_silver: '🥈 Reaches Silver', tier_gold: '🥇 Reaches Gold',
                    inactivity_30: '💤 30-Day Inactive', inactivity_60: '😴 60-Day Inactive',
                    inactivity_90: '🚨 90-Day Inactive', birthday: '🎂 Birthday',
                    points_milestone: '⭐ Points Milestone', referral_made: '👥 Referral Made',
                  }
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-300">Automation Flows</div>
                        <button onClick={() => setTab('flows')} className="text-xs text-gray-500 hover:text-white transition">View all →</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {flows.map(f => {
                          const triggerLabels = f.trigger.split(',').map(t => TRIGGER_LABELS[t.trim()] || t.trim())
                          const completionRate = f.enrolled > 0 ? Math.round((f.completed_enrollments / f.enrolled) * 100) : 0
                          return (
                            <button key={f.id} onClick={() => setFlowDetail(f)}
                              className="bg-[#16162a] border border-white/10 hover:border-purple-500/40 rounded-xl p-4 text-left transition group w-full">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white truncate group-hover:text-purple-300 transition">{f.name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5 truncate">{triggerLabels.join(' · ')}</div>
                                </div>
                                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${f.active ? 'bg-green-900/50 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                                  {f.active ? 'Active' : 'Draft'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">👥 {f.enrolled} enrolled</span>
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">⚡ {f.active_enrollments} active</span>
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-full">✓ {completionRate}% done</span>
                                {f.error_enrollments > 0 && <span className="text-xs bg-red-900/40 text-red-400 px-2 py-1 rounded-full">⚠ {f.error_enrollments} errors</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {tab === 'customers' && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-purple-400">Customers ({customers.length})</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setAddCustomerOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition">+ Add Customer</button>
                <button onClick={() => importRef.current?.click()} disabled={importing} className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 px-3 py-2 rounded-lg transition disabled:opacity-40">{importing ? 'Importing…' : '↑ Import CSV'}</button>
                <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  setImporting(true); setImportMsg('')
                  const text = await file.text()
                  const r = await fetch('/api/merchant/customers/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text })
                  const d = await r.json()
                  setImportMsg(d.message || (r.ok ? 'Done' : d.error))
                  setImporting(false); if (r.ok) loadCustomers()
                  e.target.value = ''
                }} />
                <button onClick={() => {
                  const filtered = customers.filter((c: any) => (tierFilter === 'All' || c.tier === tierFilter) && (!customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())))
                  const headers = ['Name', 'Email', 'Phone', 'Birthday', 'Points', 'Lifetime Points', 'Tier', 'Joined']
                  const rows = filtered.map((c: any) => [c.name || '', c.email || '', c.phone || '', c.birthday || '', c.points, c.lifetime_points || 0, c.tier, new Date(c.created_at).toLocaleDateString()])
                  const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
                  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`; a.click()
                }} className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 px-3 py-2 rounded-lg transition">↓ Export CSV</button>
              </div>
            </div>
            {importMsg && <p className="text-sm text-green-400">{importMsg}</p>}

            {/* Search + tier filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search by name or email…" className="bg-[#16162a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50 w-64" />
              <div className="flex gap-1.5">
                {(['All', 'Bronze', 'Silver', 'Gold'] as const).map(t => (
                  <button key={t} onClick={() => setTierFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tierFilter === t ? t === 'Gold' ? 'bg-yellow-500 text-black' : t === 'Silver' ? 'bg-gray-400 text-black' : t === 'Bronze' ? 'bg-orange-500 text-black' : 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{t}</button>
                ))}
              </div>
            </div>

            {/* Table */}
            {customers.length === 0 ? <p className="text-gray-500 text-sm">No customers yet.</p> : (() => {
              const filtered = customers.filter((c: any) => (tierFilter === 'All' || c.tier === tierFilter) && (!customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())))
              return filtered.length === 0 ? <p className="text-gray-500 text-sm">No customers match your search.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-[#1f1f3a]"><tr>{['Name','Email','Points','Tier','Joined',''].map(h => <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>)}</tr></thead>
                    <tbody>{filtered.map((c: any) => (
                      <tr key={c.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => {
                        setCustomerDetail(c)
                        setCustomerDetailEdits({ name: c.name || '', phone: c.phone || '', birthday: c.birthday || '', pointsAdjust: '0' })
                        setCustomerDetailLoading(true)
                        fetch(`/api/merchant/customers?id=${c.id}`).then(r => r.json()).then(d => { setCustomerDetailHistory(d.history || []); setCustomerDetailLoading(false) })
                      }}>
                        <td className="px-4 py-3 font-medium">{c.name || <span className="text-gray-600">—</span>}</td>
                        <td className="px-4 py-3 text-gray-400">{c.email}</td>
                        <td className="px-4 py-3 text-purple-400 font-bold">{c.points.toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${c.tier==='Gold'?'bg-yellow-900 text-yellow-400':c.tier==='Silver'?'bg-gray-700 text-gray-300':'bg-orange-900 text-orange-400'}`}>{c.tier}</span></td>
                        <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">View →</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
            })()}

            {/* Add Customer Modal */}
            {addCustomerOpen && (
              <>
                <div className="fixed inset-0 bg-black/60 z-40" onClick={() => { setAddCustomerOpen(false); setAddCustomerMsg('') }} />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">Add Customer</h3>
                      <button onClick={() => { setAddCustomerOpen(false); setAddCustomerMsg('') }} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
                    </div>
                    <div className="space-y-3">
                      <input placeholder="Name" value={addCustomerForm.name} onChange={e => setAddCustomerForm(p => ({...p, name: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50" />
                      <input placeholder="Email *" value={addCustomerForm.email} onChange={e => setAddCustomerForm(p => ({...p, email: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50" />
                      <input placeholder="Phone" value={addCustomerForm.phone} onChange={e => setAddCustomerForm(p => ({...p, phone: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50" />
                      <div><label className="text-xs text-gray-400 mb-1 block">Birthday</label><input type="date" value={addCustomerForm.birthday} onChange={e => setAddCustomerForm(p => ({...p, birthday: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50" /></div>
                      <div><label className="text-xs text-gray-400 mb-1 block">Starting points</label><input type="number" value={addCustomerForm.points} onChange={e => setAddCustomerForm(p => ({...p, points: e.target.value}))} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50" /></div>
                    </div>
                    {addCustomerMsg && <p className={`text-sm ${addCustomerMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{addCustomerMsg}</p>}
                    <button disabled={addCustomerSaving || !addCustomerForm.email} onClick={async () => {
                      setAddCustomerSaving(true); setAddCustomerMsg('')
                      const r = await fetch('/api/merchant/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...addCustomerForm, points: parseInt(addCustomerForm.points) || 0 }) })
                      const d = await r.json()
                      if (r.ok) { setAddCustomerMsg('✓ Customer added'); setAddCustomerForm({ name: '', email: '', phone: '', birthday: '', points: '0' }); loadCustomers() }
                      else setAddCustomerMsg(d.error || 'Failed')
                      setAddCustomerSaving(false)
                    }} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition">
                      {addCustomerSaving ? 'Adding…' : 'Add Customer'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Customer Detail Drawer */}
            {customerDetail && (() => {
              const c = customerDetail
              const TX_LABELS: Record<string, string> = { earn_order: 'Order', earn_purchase: 'Order', earn_signup: 'Sign-up', earn_referral: 'Referral', earn_follow: 'Social follow', earn_birthday: 'Birthday', earn_flow: 'Flow reward', earn_adjustment: 'Adjustment', redeem: 'Redemption', deduct_cancel: 'Order cancelled', deduct_adjustment: 'Adjustment' }
              return (
                <>
                  <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setCustomerDetail(null)} />
                  <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
                    <div className="px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-white text-lg">{c.name || c.email}</div>
                          <div className="text-sm text-gray-400">{c.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${c.tier==='Gold'?'bg-yellow-900 text-yellow-400':c.tier==='Silver'?'bg-gray-700 text-gray-300':'bg-orange-900 text-orange-400'}`}>{c.tier}</span>
                          <button onClick={() => setCustomerDetail(null)} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                      {/* Points */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#0f0f1a] rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-purple-400">{c.points.toLocaleString()}</div>
                          <div className="text-xs text-gray-500 mt-1">Current Points</div>
                        </div>
                        <div className="bg-[#0f0f1a] rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-gray-300">{(c.lifetime_points || 0).toLocaleString()}</div>
                          <div className="text-xs text-gray-500 mt-1">Lifetime Points</div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="bg-[#0f0f1a] rounded-xl p-4 space-y-3">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Info</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs text-gray-500 block mb-1">Name</label><input value={customerDetailEdits.name} onChange={e => setCustomerDetailEdits(p => ({...p, name: e.target.value}))} className="w-full bg-[#16162a] border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500/50" /></div>
                          <div><label className="text-xs text-gray-500 block mb-1">Phone</label><input value={customerDetailEdits.phone} onChange={e => setCustomerDetailEdits(p => ({...p, phone: e.target.value}))} className="w-full bg-[#16162a] border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500/50" /></div>
                          <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Birthday</label><input type="date" value={customerDetailEdits.birthday} onChange={e => setCustomerDetailEdits(p => ({...p, birthday: e.target.value}))} className="w-full bg-[#16162a] border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500/50" /></div>
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1"><label className="text-xs text-gray-500 block mb-1">Adjust Points</label><input type="number" value={customerDetailEdits.pointsAdjust} onChange={e => setCustomerDetailEdits(p => ({...p, pointsAdjust: e.target.value}))} placeholder="e.g. 50 or -50" className="w-full bg-[#16162a] border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500/50" /></div>
                        </div>
                        <button disabled={customerDetailSaving} onClick={async () => {
                          setCustomerDetailSaving(true)
                          const adj = parseInt(customerDetailEdits.pointsAdjust) || 0
                          await fetch('/api/merchant/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, name: customerDetailEdits.name, phone: customerDetailEdits.phone, birthday: customerDetailEdits.birthday, points_adjust: adj }) })
                          const updated = { ...c, name: customerDetailEdits.name, phone: customerDetailEdits.phone, birthday: customerDetailEdits.birthday, points: Math.max(0, c.points + adj) }
                          setCustomerDetail(updated)
                          setCustomerDetailEdits(p => ({...p, pointsAdjust: '0'}))
                          setCustomers(prev => prev.map((x: any) => x.id === c.id ? updated : x))
                          setCustomerDetailSaving(false)
                          fetch(`/api/merchant/customers?id=${c.id}`).then(r => r.json()).then(d => setCustomerDetailHistory(d.history || []))
                        }} className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition">
                          {customerDetailSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                      </div>

                      {/* Consent */}
                      <div className="flex gap-3">
                        <div className={`flex-1 rounded-xl p-3 text-center text-xs ${c.marketing_consent !== false ? 'bg-green-900/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>✉️ Email {c.marketing_consent !== false ? 'Opted in' : 'Opted out'}</div>
                        <div className={`flex-1 rounded-xl p-3 text-center text-xs ${c.whatsapp_consent !== false ? 'bg-green-900/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>💬 WhatsApp {c.whatsapp_consent !== false ? 'Opted in' : 'Opted out'}</div>
                      </div>

                      {/* Delete */}
                      <button onClick={async () => {
                        if (!confirm(`Delete ${c.name || c.email}? They'll be archived and can be restored from the admin panel.`)) return
                        await fetch(`/api/merchant/customers?id=${c.id}`, { method: 'DELETE' })
                        setCustomers(prev => prev.filter((x: any) => x.id !== c.id))
                        setCustomerDetail(null)
                      }} className="w-full text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-700/40 text-sm font-semibold py-2 rounded-xl transition">
                        Delete Customer
                      </button>

                      {/* Transaction History */}
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent Activity</div>
                        {customerDetailLoading ? <p className="text-sm text-gray-500">Loading…</p> : customerDetailHistory.length === 0 ? <p className="text-sm text-gray-600">No transactions yet.</p> : (
                          <div className="space-y-2">
                            {customerDetailHistory.map((tx: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div>
                                  <span className="text-gray-300">{TX_LABELS[tx.type] || tx.type}</span>
                                  {tx.description && <span className="text-gray-600 text-xs ml-2">{tx.description}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={tx.points > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{tx.points > 0 ? '+' : ''}{tx.points} pts</span>
                                  <span className="text-gray-600 text-xs">{new Date(tx.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
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
                  <label className="block text-sm text-gray-400 mb-1">Bonus points on purchase <span className="text-gray-600 font-normal">(optional — awarded automatically when a recipient buys)</span></label>
                  <input type="number" min={0} value={newCampaign.bonusPoints || ''} onChange={e => setNewCampaign(p => ({...p, bonusPoints: Math.max(0, parseInt(e.target.value) || 0)}))} placeholder="0" className="w-32 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm" />
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
                        {f.enrolled > 0 && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-500">👥 {f.enrolled}</span>
                            <span className="text-xs text-yellow-500">⚡ {f.active_enrollments}</span>
                            <span className="text-xs text-green-500">✓ {f.completed_enrollments}</span>
                            {f.error_enrollments > 0 && <span className="text-xs text-red-400">⚠ {f.error_enrollments} errors</span>}
                          </div>
                        )}
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

        {tab === 'whatsapp' && merchant && !merchant.is_premium && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-2">WhatsApp is a Premium Feature</h2>
            <p className="text-gray-400 max-w-md mb-2">Send automated WhatsApp messages to your customers — points earned, tier upgrades, and more. Upgrade to Premium to unlock.</p>
            <p className="text-sm text-gray-600">Contact us to upgrade your plan.</p>
          </div>
        )}

        {tab === 'whatsapp' && merchant && merchant.is_premium && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-green-400">💬 WhatsApp Templates</h2>
              <div className="flex items-center gap-2">
                {merchant.whatsapp_waba_id && (
                  <button
                    onClick={connectWhatsApp}
                    disabled={waConnecting}
                    className="text-xs border border-green-800 hover:border-green-600 px-3 py-1.5 rounded-lg text-green-500 hover:text-green-400 transition disabled:opacity-40"
                  >
                    {waConnecting ? 'Connecting…' : '↺ Reconnect'}
                  </button>
                )}
              <button
                disabled={waSyncing || !merchant.whatsapp_waba_id}
                onClick={async () => {
                  setWaSyncing(true)
                  await fetch('/api/merchant/whatsapp-templates', { method: 'PATCH' })
                  await loadWaTemplates()
                  setWaSyncing(false)
                }}
                className="text-xs border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition disabled:opacity-40"
              >
                {waSyncing ? 'Syncing…' : '↻ Sync Status'}
              </button>
              </div>
            </div>

            {!merchant.whatsapp_waba_id && (
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">💬</div>
                <div className="text-white font-semibold text-lg mb-2">Connect Your WhatsApp Business Account</div>
                <div className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Click below to connect your Meta WhatsApp Business account in a few quick steps.</div>
                <button
                  onClick={connectWhatsApp}
                  disabled={waConnecting}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition"
                >
                  {waConnecting ? 'Connecting…' : '🔗 Connect WhatsApp'}
                </button>
                {waConnectMsg && <p className={`text-sm mt-3 ${waConnectMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{waConnectMsg}</p>}
              </div>
            )}

            {merchant.whatsapp_waba_id && (
              <>
                {/* Existing templates */}
                {waLoading ? (
                  <p className="text-sm text-gray-500">Loading templates…</p>
                ) : waTemplates.length === 0 ? (
                  <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 text-center text-gray-500 text-sm">No templates yet. Create one below.</div>
                ) : (
                  <div className="space-y-3">
                    {waTemplates.map(t => {
                      const statusColor: Record<string, string> = {
                        APPROVED: 'bg-green-900/40 text-green-400',
                        PENDING: 'bg-yellow-900/40 text-yellow-400',
                        REJECTED: 'bg-red-900/40 text-red-400',
                        draft: 'bg-gray-800 text-gray-500',
                        error: 'bg-red-900/40 text-red-400',
                      }
                      return (
                        <div key={t.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4 flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-sm text-white font-semibold">{t.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{t.category}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor[t.status] || 'bg-gray-800 text-gray-500'}`}>{t.status}</span>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">{t.body}</p>
                            {t.rejection_reason && <p className="text-xs text-red-400 mt-1">Rejected: {t.rejection_reason}</p>}
                          </div>
                          <button
                            onClick={async () => {
                              await fetch(`/api/merchant/whatsapp-templates?id=${t.id}`, { method: 'DELETE' })
                              setWaTemplates(prev => prev.filter(x => x.id !== t.id))
                            }}
                            className="text-xs text-red-500 hover:text-red-400 shrink-0 transition"
                          >Delete</button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Create new template */}
                <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-white">Create New Template</h3>
                  <div className="bg-[#0f0f1a] rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <div>Variables: <span className="text-purple-400 font-mono">{'{{1}}'}</span> = customer name · <span className="text-purple-400 font-mono">{'{{2}}'}</span> = store name · <span className="text-purple-400 font-mono">{'{{3}}'}</span> = points · <span className="text-purple-400 font-mono">{'{{4}}'}</span> = tier</div>
                    <div>Template name must be lowercase with underscores only, e.g. <span className="text-gray-300 font-mono">my_store_welcome</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Template Name</label>
                      <input
                        value={waForm.name}
                        onChange={e => setWaForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                        placeholder="my_loyalty_welcome"
                        className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Category</label>
                      <select
                        value={waForm.category}
                        onChange={e => setWaForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                      >
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Message Body</label>
                    <textarea
                      value={waForm.body}
                      onChange={e => setWaForm(p => ({ ...p, body: e.target.value }))}
                      rows={5}
                      placeholder={'Hi {{1}}, you have {{3}} points at {{2}}! 🎉'}
                      className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500 resize-none"
                    />
                  </div>
                  {waMsg && <p className={`text-xs ${waMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{waMsg}</p>}
                  <button
                    disabled={waSubmitting || !waForm.name || !waForm.body}
                    onClick={async () => {
                      setWaSubmitting(true); setWaMsg('')
                      const r = await fetch('/api/merchant/whatsapp-templates', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(waForm),
                      })
                      const d = await r.json()
                      setWaSubmitting(false)
                      if (r.ok || r.status === 422) {
                        setWaTemplates(prev => [d, ...prev])
                        setWaForm({ name: '', category: 'MARKETING', body: '' })
                        setWaMsg(d.status === 'PENDING' ? '✓ Submitted to Meta for review!' : d.status === 'error' ? `Meta error: ${d.meta_error}` : '✓ Saved as draft (WhatsApp not yet configured)')
                        setTimeout(() => setWaMsg(''), 5000)
                      } else { setWaMsg(d.error || 'Failed to create template') }
                    }}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-40 px-5 py-2 rounded-lg font-semibold text-sm transition"
                  >
                    {waSubmitting ? 'Submitting…' : 'Submit to Meta for Approval'}
                  </button>
                </div>
              </>
            )}
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

                {/* Color style */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Button Style</label>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setMerchant(p => p ? {...p, widget_gradient_color: ''} : p)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${!merchant.widget_gradient_color ? 'bg-purple-600 border-purple-500 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white'}`}>Solid</button>
                    <button onClick={() => setMerchant(p => p ? {...p, widget_gradient_color: p.widget_gradient_color || '#ff6b6b'} : p)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${merchant.widget_gradient_color ? 'bg-purple-600 border-purple-500 text-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white'}`}>Gradient</button>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">{merchant.widget_gradient_color ? 'Start color' : 'Color'}</span>
                      <input type="color" value={merchant.widget_primary_color || '#6c3fff'} onChange={e => setMerchant(p => p ? {...p, widget_primary_color: e.target.value} : p)} className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border-0" />
                    </div>
                    {merchant.widget_gradient_color && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">End color</span>
                        <input type="color" value={merchant.widget_gradient_color || '#ff6b6b'} onChange={e => setMerchant(p => p ? {...p, widget_gradient_color: e.target.value} : p)} className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border-0" />
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Text color</span>
                      <input type="color" value={merchant.widget_btn_text_color || '#ffffff'} onChange={e => setMerchant(p => p ? {...p, widget_btn_text_color: e.target.value} : p)} className="h-10 w-16 rounded-lg cursor-pointer bg-transparent border-0" />
                    </div>
                    {/* Live preview */}
                    <div className="ml-2">
                      <span className="text-xs text-gray-500 block mb-1">Preview</span>
                      <div className="h-10 px-4 rounded-full flex items-center gap-2 text-sm font-bold shadow-lg" style={{
                        background: merchant.widget_gradient_color
                          ? `linear-gradient(135deg, ${merchant.widget_primary_color || '#6c3fff'}, ${merchant.widget_gradient_color})`
                          : (merchant.widget_primary_color || '#6c3fff'),
                        color: merchant.widget_btn_text_color || '#ffffff'
                      }}>
                        🎁 {merchant.widget_title || 'Rewards'}
                      </div>
                    </div>
                  </div>
                </div>
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

                {/* Phone field settings */}
                <div className="border-t border-white/10 pt-4">
                  <label className="block text-sm text-gray-300 font-semibold mb-3">Phone Number Field</label>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="text-sm text-gray-400">Required?</label>
                    <button onClick={() => setMerchant(p => p ? {...p, widget_phone_required: !p.widget_phone_required} : p)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${merchant.widget_phone_required ? 'bg-purple-600' : 'bg-white/10'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${merchant.widget_phone_required ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs text-gray-500">{merchant.widget_phone_required ? 'Required' : 'Optional'}</span>
                  </div>
                  <label className="block text-sm text-gray-400 mb-1">Country / Dial Code</label>
                  <select value={merchant.widget_store_country || 'INTL'} onChange={e => setMerchant(p => p ? {...p, widget_store_country: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full max-w-xs">
                    <option value="INTL">🌍 International (customer picks country)</option>
                    <option value="US">🇺🇸 United States (+1)</option>
                    <option value="GB">🇬🇧 United Kingdom (+44)</option>
                    <option value="CA">🇨🇦 Canada (+1)</option>
                    <option value="AU">🇦🇺 Australia (+61)</option>
                    <option value="LB">🇱🇧 Lebanon (+961)</option>
                    <option value="AE">🇦🇪 UAE (+971)</option>
                    <option value="SA">🇸🇦 Saudi Arabia (+966)</option>
                    <option value="KW">🇰🇼 Kuwait (+965)</option>
                    <option value="QA">🇶🇦 Qatar (+974)</option>
                    <option value="BH">🇧🇭 Bahrain (+973)</option>
                    <option value="OM">🇴🇲 Oman (+968)</option>
                    <option value="JO">🇯🇴 Jordan (+962)</option>
                    <option value="EG">🇪🇬 Egypt (+20)</option>
                    <option value="TR">🇹🇷 Turkey (+90)</option>
                    <option value="DE">🇩🇪 Germany (+49)</option>
                    <option value="FR">🇫🇷 France (+33)</option>
                    <option value="IT">🇮🇹 Italy (+39)</option>
                    <option value="ES">🇪🇸 Spain (+34)</option>
                    <option value="NL">🇳🇱 Netherlands (+31)</option>
                    <option value="SE">🇸🇪 Sweden (+46)</option>
                    <option value="NO">🇳🇴 Norway (+47)</option>
                    <option value="CH">🇨🇭 Switzerland (+41)</option>
                    <option value="PL">🇵🇱 Poland (+48)</option>
                    <option value="IN">🇮🇳 India (+91)</option>
                    <option value="PK">🇵🇰 Pakistan (+92)</option>
                    <option value="NG">🇳🇬 Nigeria (+234)</option>
                    <option value="ZA">🇿🇦 South Africa (+27)</option>
                    <option value="BR">🇧🇷 Brazil (+55)</option>
                    <option value="MX">🇲🇽 Mexico (+52)</option>
                    <option value="SG">🇸🇬 Singapore (+65)</option>
                    <option value="MY">🇲🇾 Malaysia (+60)</option>
                    <option value="PH">🇵🇭 Philippines (+63)</option>
                    <option value="JP">🇯🇵 Japan (+81)</option>
                    <option value="KR">🇰🇷 South Korea (+82)</option>
                    <option value="HK">🇭🇰 Hong Kong (+852)</option>
                    <option value="NZ">🇳🇿 New Zealand (+64)</option>
                    <option value="MA">🇲🇦 Morocco (+212)</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-1">Single country: shows flag + dial code automatically. International: customer picks from a dropdown.</p>
                </div>

                <div><label className="block text-sm text-gray-400 mb-1">Points per $1 spent</label><input type="number" value={merchant.points_per_dollar || 1} onChange={e => setMerchant(p => p ? {...p, points_per_dollar: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Sign-up bonus points</label><input type="number" value={merchant.signup_bonus || 0} onChange={e => setMerchant(p => p ? {...p, signup_bonus: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Birthday bonus points</label><input type="number" value={(merchant as any).birthday_bonus || 0} onChange={e => setMerchant(p => p ? {...p, birthday_bonus: +e.target.value} as any : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
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
              {(merchant.whatsapp_credits ?? 0) > 0 && (
                <div className="bg-[#16162a] border border-green-500/20 rounded-xl p-6 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">💬 WhatsApp Credits</p>
                    <p className="text-2xl font-bold text-green-400">{merchant.whatsapp_credits}</p>
                  </div>
                  <p className="text-xs text-gray-500 max-w-[180px] text-right">Credits are deducted each time a WhatsApp message is sent through a flow</p>
                </div>
              )}
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
      {/* Flow Detail Drawer */}
      {flowDetail && (() => {
        const f = flowDetail
        const completionRate = f.enrolled > 0 ? ((f.completed_enrollments / f.enrolled) * 100).toFixed(1) : '0.0'
        const TRIGGER_LABELS: Record<string, string> = {
          signup: '🎉 New Signup', first_purchase: '🛍️ First Purchase',
          tier_silver: '🥈 Reaches Silver', tier_gold: '🥇 Reaches Gold',
          inactivity_30: '💤 30-Day Inactive', inactivity_60: '😴 60-Day Inactive',
          inactivity_90: '🚨 90-Day Inactive', birthday: '🎂 Birthday',
          points_milestone: '⭐ Points Milestone', referral_made: '👥 Referral Made',
        }
        const triggerLabels = f.trigger.split(',').map(t => TRIGGER_LABELS[t.trim()] || t.trim())
        return (
          <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setFlowDetail(null)} />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
              <div className="px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white text-base">{f.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{triggerLabels.join(' · ')}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.active ? 'bg-green-900/50 text-green-400' : 'bg-white/5 text-gray-500'}`}>{f.active ? 'Active' : 'Draft'}</span>
                    <button onClick={() => setFlowDetail(null)} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Period filter */}
                <div className="flex gap-1.5">
                  {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['all', 'All']].map(([v, l]) => (
                    <button key={v} onClick={() => setFlowPeriod(v)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${flowPeriod === v ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{l}</button>
                  ))}
                </div>

                {/* Channel performance */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f0f1a] rounded-xl p-4">
                    <div className="text-sm mb-2">✉️ Email</div>
                    <div className="text-xl font-bold text-blue-400">{(flowAnalytics?.email_sends ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">messages sent</div>
                    <div className="text-base font-semibold text-emerald-400 mt-2">${(flowAnalytics?.email_revenue ?? 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">attributed revenue</div>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-xl p-4">
                    <div className="text-sm mb-2">💬 WhatsApp</div>
                    <div className="text-xl font-bold text-green-400">{(flowAnalytics?.whatsapp_sends ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">messages sent</div>
                    <div className="text-base font-semibold text-emerald-400 mt-2">${(flowAnalytics?.whatsapp_revenue ?? 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">attributed revenue</div>
                  </div>
                </div>

                {/* Enrollment stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Enrolled', value: f.enrolled.toLocaleString(), icon: '👥', color: 'text-white' },
                    { label: 'Currently Active', value: f.active_enrollments.toLocaleString(), icon: '⚡', color: 'text-yellow-400' },
                    { label: 'Completed', value: f.completed_enrollments.toLocaleString(), icon: '✓', color: 'text-green-400' },
                    { label: 'Completion Rate', value: `${completionRate}%`, icon: '📊', color: 'text-purple-400' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-[#0f0f1a] rounded-xl p-4">
                      <div className="text-lg mb-1">{stat.icon}</div>
                      <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
                {f.error_enrollments > 0 && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-red-400">⚠ {f.error_enrollments} enrollment{f.error_enrollments !== 1 ? 's' : ''} stalled</div>
                      <div className="text-xs text-gray-500 mt-0.5">Failed 3 times — reset from Admin panel to retry</div>
                    </div>
                  </div>
                )}
                {flowAnalytics?.trend && (
                  <BarChart title="Enrollments — Last 30 Days" data={flowAnalytics.trend} color="#a78bfa" />
                )}
                {/* Test runner */}
                <div className="bg-[#0f0f1a] border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-purple-300">▶ Run Test</div>
                  <div className="text-xs text-gray-500">Instantly runs this flow for a customer — emails and WhatsApp messages will actually send.</div>
                  <div className="flex gap-2">
                    <input
                      value={flowTest.email}
                      onChange={e => setFlowTest(p => ({ ...p, email: e.target.value, log: [] }))}
                      placeholder="customer@email.com"
                      className="flex-1 bg-[#16162a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500/50"
                    />
                    <button
                      disabled={flowTest.running || !flowTest.email}
                      onClick={async () => {
                        setFlowTest(p => ({ ...p, running: true, log: [] }))
                        const r = await fetch('/api/merchant/flows/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ flow_id: f.id, customer_email: flowTest.email }),
                        })
                        const d = await r.json()
                        setFlowTest(p => ({ ...p, running: false, log: r.ok ? d.log : [`✗ ${d.error}`] }))
                      }}
                      className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {flowTest.running ? 'Running…' : 'Run'}
                    </button>
                  </div>
                  {flowTest.log.length > 0 && (
                    <div className="space-y-1">
                      {flowTest.log.map((line, i) => <div key={i} className="text-xs text-gray-300 font-mono">{line}</div>)}
                    </div>
                  )}
                </div>

                <button onClick={() => { setFlowDetail(null); router.push(`/merchant/flows/${f.id}`) }}
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition py-2 border border-white/10 hover:border-white/25 rounded-lg">
                  Open in Flow Builder →
                </button>
                <button onClick={() => { setFlowDetail(null); setTab('flows') }}
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition py-2 border border-white/10 hover:border-white/25 rounded-lg">
                  Go to Flows tab →
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* Campaign Detail Drawer */}
      {campaignDetail && (() => {
        const c = campaignDetail
        const ctr = c.recipient_count > 0 ? ((c.link_clicks / c.recipient_count) * 100).toFixed(1) : '0.0'
        const rpe = c.recipient_count > 0 ? (c.attributed_revenue / c.recipient_count).toFixed(2) : '0.00'
        const convRate = c.link_clicks > 0 ? ((c.attributed_orders / c.link_clicks) * 100).toFixed(1) : '0.0'
        return (
          <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setCampaignDetail(null)} />
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
              <div className="px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white text-base">{c.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Sent {new Date(c.created_at || c.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <button onClick={() => setCampaignDetail(null)} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center shrink-0">×</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Revenue highlight */}
                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400">${c.attributed_revenue.toFixed(2)}</div>
                  <div className="text-xs text-gray-400 mt-1">Attributed Revenue</div>
                  <div className="text-xs text-gray-600 mt-0.5">${rpe} per email sent</div>
                </div>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Emails Sent', value: c.recipient_count.toLocaleString(), icon: '📧', color: 'text-white' },
                    { label: 'Opens', value: (c.open_count ?? 0).toLocaleString(), icon: '👁', color: 'text-sky-400', sub: `${c.open_rate ?? 0}% open rate` },
                    { label: 'Link Clicks', value: c.link_clicks.toLocaleString(), icon: '👆', color: 'text-blue-400', sub: `${ctr}% CTR` },
                    { label: 'Attributed Orders', value: c.attributed_orders.toLocaleString(), icon: '🛒', color: 'text-purple-400', sub: `${convRate}% conv. rate` },
                    { label: 'Revenue / Email', value: `$${rpe}`, icon: '📈', color: 'text-emerald-400' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-[#0f0f1a] rounded-xl p-4">
                      <div className="text-lg mb-1">{stat.icon}</div>
                      <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                      {stat.sub && <div className="text-xs text-gray-600 mt-0.5">{stat.sub}</div>}
                    </div>
                  ))}
                </div>
                <button onClick={() => { setCampaignDetail(null); setTab('campaigns') }}
                  className="w-full text-center text-xs text-gray-500 hover:text-white transition py-2 border border-white/10 hover:border-white/25 rounded-lg">
                  Go to Campaigns tab →
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {drawer.type && (() => {
        const TYPE_LABEL: Record<string, string> = {
          earn_order: 'Purchase', earn_purchase: 'Purchase', earn_signup: 'Sign-up bonus', earn_referral: 'Referral',
          earn_follow: 'Social follow', earn_birthday: 'Birthday bonus', earn_campaign_bonus: 'Campaign bonus',
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
