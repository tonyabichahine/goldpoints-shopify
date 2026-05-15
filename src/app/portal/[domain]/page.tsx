'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface MerchantInfo { store_name: string; widget_primary_color: string; widget_title: string }
interface Customer { id: string; name: string; email: string; points: number; tier: string; created_at: string }
interface Offer { id: string; name: string; description: string; points_required: number; offer_type: string; offer_value: string }
interface Transaction { id: string; type: string; points: number; description: string; created_at: string }

export default function CustomerPortal() {
  const { domain } = useParams<{ domain: string }>()
  const shop = decodeURIComponent(domain)

  const [merchant, setMerchant] = useState<MerchantInfo | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [view, setView] = useState<'login' | 'dashboard'>('login')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [history, setHistory] = useState<Transaction[]>([])
  const [redeemMsg, setRedeemMsg] = useState<{ code: string; offer: string } | null>(null)

  useEffect(() => {
    fetch(`/api/widget/config?shop=${shop}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setNotFound(true); return }
        setMerchant({ store_name: d.store_name, widget_primary_color: d.widget_primary_color, widget_title: d.widget_title })
        setOffers(d.offers || [])
      })
  }, [shop])

  async function handleLogin() {
    if (!email || !birthday) { setLoginError('Please enter your email and birthday.'); return }
    setLoggingIn(true); setLoginError('')
    const r = await fetch('/api/portal/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, email, birthday }) })
    const data = await r.json()
    if (!r.ok) { setLoginError(data.error || 'Not found. Make sure you registered through the store.'); setLoggingIn(false); return }
    setCustomer(data.customer)
    setHistory(data.history || [])
    setView('dashboard')
    setLoggingIn(false)
  }

  async function handleRedeem(offer: Offer) {
    const r = await fetch('/api/widget/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, email: customer?.email, offerId: offer.id }) })
    const data = await r.json()
    if (data.error) { alert(data.error); return }
    setCustomer(prev => prev ? { ...prev, points: data.newPoints } : prev)
    setRedeemMsg({ code: data.discountCode, offer: offer.name })
    const hRes = await fetch(`/api/portal/history?shop=${shop}&email=${customer?.email}`)
    setHistory(await hRes.json())
  }

  const color = merchant?.widget_primary_color || '#6c3fff'

  function tierClass(tier: string) {
    if (tier === 'Gold') return 'bg-yellow-900 text-yellow-400 border border-yellow-600'
    if (tier === 'Silver') return 'bg-gray-700 text-gray-300 border border-gray-500'
    return 'bg-orange-900 text-orange-400 border border-orange-600'
  }

  function progressPct(pts: number) {
    if (pts >= 1000) return 100
    if (pts >= 500) return Math.round(((pts - 500) / 500) * 100)
    return Math.round((pts / 500) * 100)
  }

  function nextTier(pts: number) {
    if (pts < 500) return `${500 - pts} pts to Silver`
    if (pts < 1000) return `${1000 - pts} pts to Gold`
    return 'Max tier reached!'
  }

  function txIcon(type: string) {
    if (type === 'redeem') return '🎁'
    if (type === 'earn_signup') return '👋'
    if (type === 'earn_birthday') return '🎂'
    return '⭐'
  }

  if (notFound) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-center p-6">
      <div>
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-white text-xl font-bold mb-2">Store not found</h1>
        <p className="text-gray-500 text-sm">This store hasn't set up GoldPoints yet.</p>
      </div>
    </div>
  )

  if (!merchant) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Header */}
      <header className="py-5 px-6 text-center border-b border-white/10" style={{ background: `${color}18` }}>
        <div className="text-2xl font-extrabold" style={{ color }}>⭐ {merchant.widget_title}</div>
        <div className="text-sm text-gray-400 mt-1">{merchant.store_name}</div>
      </header>

      <main className="max-w-lg mx-auto p-6">

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-1">Welcome back</h2>
            <p className="text-gray-400 text-sm mb-6">Enter the email and birthday you used to register.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="w-full bg-[#16162a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Birthday</label>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className="w-full bg-[#16162a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition" />
              </div>
              {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
              <button onClick={handleLogin} disabled={loggingIn} style={{ background: color }} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition hover:opacity-90">
                {loggingIn ? 'Checking...' : 'View My Points'}
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-4">Not registered yet? Visit the store and sign up through the rewards widget.</p>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {view === 'dashboard' && customer && (
          <div className="mt-4 space-y-5">
            {/* Points card */}
            <div className="rounded-2xl p-6 text-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
              <p className="text-gray-400 text-sm mb-1">Hi, {customer.name} 👋</p>
              <div className="text-5xl font-black" style={{ color }}>{customer.points.toLocaleString()}</div>
              <div className="text-gray-400 text-sm mt-1">points</div>
              <span className={`inline-block mt-3 px-4 py-1 rounded-full text-xs font-bold ${tierClass(customer.tier)}`}>{customer.tier}</span>
              <div className="mt-3 bg-black/20 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct(customer.points)}%`, background: color }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{nextTier(customer.points)}</p>
            </div>

            {/* Redeem success */}
            {redeemMsg && (
              <div className="bg-green-900/30 border border-green-500 rounded-2xl p-4 text-center">
                <p className="text-green-400 font-semibold text-sm mb-1">🎉 {redeemMsg.offer} redeemed!</p>
                <p className="text-xs text-gray-400 mb-2">Use this code at checkout:</p>
                <div className="text-2xl font-black text-green-400 tracking-widest">{redeemMsg.code}</div>
                <button onClick={() => { navigator.clipboard.writeText(redeemMsg.code); }} className="mt-2 text-xs text-green-500 underline">Copy code</button>
              </div>
            )}

            {/* Offers */}
            <div>
              <h3 className="font-bold text-sm text-gray-300 mb-3 uppercase tracking-wide">Available Rewards</h3>
              {offers.length === 0 && <p className="text-gray-500 text-sm">No offers yet — check back soon!</p>}
              <div className="space-y-2">
                {offers.map(o => {
                  const canRedeem = customer.points >= o.points_required
                  return (
                    <div key={o.id} className={`rounded-xl p-4 flex items-center justify-between border ${canRedeem ? 'bg-[#16162a] border-white/10' : 'bg-[#111120] border-white/5 opacity-60'}`}>
                      <div>
                        <div className="font-semibold text-sm">{o.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{o.description} · <span style={{ color }}>{o.points_required} pts</span></div>
                      </div>
                      <button onClick={() => handleRedeem(o)} disabled={!canRedeem} style={canRedeem ? { background: color } : {}} className="ml-4 shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold disabled:bg-gray-700 disabled:text-gray-500 text-white transition">
                        {canRedeem ? 'Redeem' : `${o.points_required - customer.points} more`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Transaction history */}
            <div>
              <h3 className="font-bold text-sm text-gray-300 mb-3 uppercase tracking-wide">Points History</h3>
              {history.length === 0 && <p className="text-gray-500 text-sm">No activity yet.</p>}
              <div className="space-y-2">
                {history.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between bg-[#16162a] border border-white/5 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{txIcon(tx.type)}</span>
                      <div>
                        <div className="text-sm">{tx.description}</div>
                        <div className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className={`font-bold text-sm ${tx.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { setView('login'); setCustomer(null); setRedeemMsg(null) }} className="w-full text-xs text-gray-600 hover:text-gray-400 py-2 transition">Sign out</button>
          </div>
        )}
      </main>
    </div>
  )
}
