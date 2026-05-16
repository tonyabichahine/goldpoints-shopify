'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'

interface Merchant { id: string; store_name: string; shopify_domain: string; shopify_access_token: string; email: string; widget_primary_color: string; widget_title: string; widget_position: string; points_per_dollar: number; signup_bonus: number; social_follow_url: string; follow_points: number; referral_points: number }
interface Stats { customers: number; total_points: number; gold: number; silver: number; bronze: number }

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

  useEffect(() => {
    fetch('/api/merchant/me')
      .then(r => { if (r.status === 401) { router.push('/'); return null } return r.json() })
      .then(d => { if (d && !d.error) setMerchant(d); setLoading(false) })
  }, [router])

  useEffect(() => {
    if (tab === 'customers') loadCustomers()
    if (tab === 'offers') loadOffers()
  }, [tab])

  async function loadCustomers() {
    const r = await fetch('/api/merchant/customers')
    setCustomers(await r.json())
  }

  async function loadOffers() {
    const r = await fetch('/api/merchant/offers')
    setOffers(await r.json())
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

      <nav className="flex gap-2 px-8 py-3 bg-[#16162a] border-b border-white/10 flex-wrap">
        {(['overview','customers','offers','widget','install','account'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm capitalize transition ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{t}</button>
        ))}
      </nav>

      <main className="p-8 max-w-5xl mx-auto">
        {tab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Dashboard</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[['Points/dollar', merchant.points_per_dollar], ['Signup bonus', merchant.signup_bonus + ' pts'], ['Widget', merchant.widget_title || 'Rewards'], ['Store', merchant.shopify_domain || 'Not connected']].map(([l, v]) => (
                <div key={l as string} className="bg-[#16162a] border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-lg font-bold text-purple-400 truncate">{v}</div>
                  <div className="text-xs text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
              <p className="text-gray-400">Switch to the <strong className="text-white">Customers</strong> tab to see your loyalty members, <strong className="text-white">Offers</strong> to manage rewards, and <strong className="text-white">Widget</strong> to customize your storefront widget.</p>
              {isConnected && <p className="text-gray-400 mt-3">Go to <strong className="text-white">Install</strong> to get the code snippet to add to your Shopify store.</p>}
            </div>
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
              <div><label className="block text-sm text-gray-400 mb-1">Primary Color</label><input type="color" value={merchant.widget_primary_color || '#6c3fff'} onChange={e => setMerchant(p => p ? {...p, widget_primary_color: e.target.value} : p)} className="h-10 w-20 rounded cursor-pointer bg-transparent border-0" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Position</label>
                <select value={merchant.widget_position || 'bottom-right'} onChange={e => setMerchant(p => p ? {...p, widget_position: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="bottom-right">Bottom Right</option><option value="bottom-left">Bottom Left</option>
                </select>
              </div>
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
