'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Store {
  shopify_domain: string
  store_name: string
  customer: { id: string; name: string; email: string; points: number; tier: string; created_at: string }
  history: unknown[]
}

export default function Home() {
  const [shop, setShop] = useState('')
  const [tab, setTab] = useState<'merchant' | 'customer'>('merchant')
  const [cEmail, setCEmail] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cLoading, setCLoading] = useState(false)
  const [cError, setCError] = useState('')
  const [stores, setStores] = useState<Store[]>([])
  const router = useRouter()

  function connectShopify() {
    if (!shop) return
    const domain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`
    window.location.href = `/api/auth/install?shop=${domain}`
  }

  async function customerLogin() {
    if (!cEmail || !cPassword) { setCError('Please enter your email and password.'); return }
    setCLoading(true); setCError(''); setStores([])
    const r = await fetch('/api/portal/global-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cEmail, password: cPassword }) })
    const data = await r.json()
    if (!r.ok) { setCError(data.error || 'Login failed.'); setCLoading(false); return }
    if (data.stores.length === 1) {
      const s = data.stores[0]
      sessionStorage.setItem(`gp_session_${s.shopify_domain}`, JSON.stringify({ customer: s.customer, history: s.history }))
      router.push(`/portal/${encodeURIComponent(s.shopify_domain)}`)
    } else {
      setStores(data.stores)
      setCLoading(false)
    }
  }

  function goToStore(s: Store) {
    sessionStorage.setItem(`gp_session_${s.shopify_domain}`, JSON.stringify({ customer: s.customer, history: s.history }))
    router.push(`/portal/${encodeURIComponent(s.shopify_domain)}`)
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-6">
      <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">GoldPoints</div>
      <p className="text-gray-500 mb-10 text-sm">Loyalty rewards for every Shopify merchant</p>

      <div className="w-full max-w-md bg-[#16162a] border border-white/10 rounded-2xl p-8">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('merchant')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab==='merchant'?'bg-purple-600 text-white':'text-gray-400 hover:text-white'}`}>I&apos;m a Merchant</button>
          <button onClick={() => setTab('customer')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab==='customer'?'bg-yellow-500 text-black':'text-gray-400 hover:text-white'}`}>I&apos;m a Customer</button>
        </div>

        {tab === 'merchant' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Shopify store</label>
              <input value={shop} onChange={e => setShop(e.target.value)} placeholder="yourstore.myshopify.com" onKeyDown={e => e.key === 'Enter' && connectShopify()} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500" />
            </div>
            <button onClick={connectShopify} className="w-full bg-gradient-to-r from-purple-700 to-purple-500 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition">Connect with Shopify</button>
            <p className="text-xs text-gray-600 text-center">You will be redirected to Shopify to approve access</p>
          </div>
        )}

        {tab === 'customer' && stores.length === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email address</label>
              <input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="you@email.com" onKeyDown={e => e.key === 'Enter' && customerLogin()} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && customerLogin()} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-500" />
            </div>
            {cError && <p className="text-red-400 text-xs">{cError}</p>}
            <button onClick={customerLogin} disabled={cLoading} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 py-3 rounded-xl font-semibold text-sm text-black hover:opacity-90 transition disabled:opacity-50">
              {cLoading ? 'Checking...' : 'View My Points →'}
            </button>
            <p className="text-xs text-gray-600 text-center">Not registered yet? Visit a store and sign up through the rewards widget.</p>
          </div>
        )}

        {tab === 'customer' && stores.length > 1 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-2">You have points at multiple stores — pick one:</p>
            {stores.map(s => (
              <button key={s.shopify_domain} onClick={() => goToStore(s)} className="w-full bg-[#0f0f1a] border border-yellow-500/30 hover:border-yellow-400 rounded-xl px-4 py-3 text-left transition">
                <div className="font-semibold text-white text-sm">{s.store_name}</div>
                <div className="text-xs text-yellow-400 mt-0.5">{s.customer.points.toLocaleString()} pts · {s.customer.tier}</div>
              </button>
            ))}
            <button onClick={() => setStores([])} className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition">← Back</button>
          </div>
        )}
      </div>
    </div>
  )
}
