'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'

interface Merchant { id: string; store_name: string; shopify_domain: string; shopify_access_token: string; email: string; widget_primary_color: string; widget_btn_text_color: string; widget_title: string; widget_position: string; widget_offset_bottom: number; widget_offset_side: number; points_per_dollar: number; signup_bonus: number; social_follow_url: string; follow_points: number; referral_points: number }
interface Stats { customers: number; total_points: number; gold: number; silver: number; bronze: number }
interface Analytics {
  totalCustomers: number; totalPointsIssued: number; totalPointsRedeemed: number; totalRedemptions: number
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
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'customers' | 'offers' | 'widget' | 'install' | 'account'>('overview')
  const [customers, setCustomers] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [newOffer, setNewOffer] = useState({ name: '', description: '', points_required: 500, offer_type: 'percentage', offer_value: '10' })
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
  }, [tab])

  async function loadCustomers() {
    const r = await fetch('/api/merchant/customers')
    setCustomers(await r.json())
  }

  async function loadOffers() {
    const r = await fetch('/api/merchant/offers')
    setOffers(await r.json())
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
    } else if (tab === 'widget' && merchant) {
      pageContext += ` Viewing widget settings: color ${merchant.widget_primary_color}, position ${merchant.widget_position}, ${merchant.points_per_dollar} pts/$1, ${merchant.signup_bonus} pt sign-up bonus.`
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
    if (!data.error) { setOffers(prev => [...prev, data]); setNewOffer({ name: '', description: '', points_required: 500, offer_type: 'percentage', offer_value: '10' }) }
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
          {(['overview','customers','offers','widget','install','account'] as const).map(t => (
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
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Customers ({customers.length})</h2>
            {customers.length === 0 ? <p className="text-gray-500">No customers yet. They register through your Shopify widget.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-[#1f1f3a]"><tr>{['Name','Email','Points','Tier','Joined'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>)}</tr></thead>
                <tbody>{customers.map((c: any) => (
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
              </div>
              <button onClick={addOffer} className="mt-4 bg-purple-600 hover:bg-purple-500 px-5 py-2 rounded-lg text-sm font-semibold">Add Offer</button>
            </div>
            <div className="space-y-3">{offers.map((o: any) => (
              <div key={o.id} className="bg-[#16162a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div><div className="font-semibold">{o.name}</div><div className="text-sm text-gray-400">{o.description} · <span className="text-purple-400">{o.points_required} pts</span> · {o.offer_type === 'shipping' ? 'Free Shipping' : `${o.offer_value}${o.offer_type==='percentage'?'% off':'$ off'}`}</div></div>
                <button onClick={() => deleteOffer(o.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
              </div>
            ))}</div>
          </div>
        )}

        {tab === 'widget' && merchant && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Widget Settings</h2>
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
        )}

        {tab === 'install' && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Install on Your Shopify Store</h2>
            {!isConnected && (
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-6 text-yellow-300 text-sm">
                Connect your Shopify store first using the yellow banner above.
              </div>
            )}
            <div className="space-y-6">
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-2">1. Copy this snippet</h3>
                <pre className="bg-[#0f0f1a] p-4 rounded-lg text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">{widgetSnippet}</pre>
                <button onClick={() => navigator.clipboard.writeText(widgetSnippet)} className="mt-3 text-sm bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg">Copy Code</button>
              </div>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">2. Add to your Shopify theme</h3>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                  <li>In Shopify Admin, go to <strong>Online Store → Themes</strong></li>
                  <li>Click <strong>Edit code</strong> on your active theme</li>
                  <li>Open <strong>theme.liquid</strong></li>
                  <li>Paste the snippet just before the <code className="text-purple-400">&lt;/body&gt;</code> tag</li>
                  <li>Save — the widget will appear on every page of your store</li>
                </ol>
              </div>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">3. Set up the orders webhook</h3>
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
        )}
        {tab === 'account' && (
          <div className="max-w-md">
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Account</h2>
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-6 mb-4">
              <p className="text-sm text-gray-400 mb-1">Logged in as</p>
              <p className="font-semibold">{merchant.email}</p>
            </div>
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Change Password</h3>
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
