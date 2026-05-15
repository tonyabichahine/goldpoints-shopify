'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Merchant { id: string; store_name: string; shopify_domain: string; widget_primary_color: string; widget_title: string; points_per_dollar: number; signup_bonus: number }
interface Stats { customers: number; total_points: number; gold: number; silver: number; bronze: number }

export default function MerchantDashboard() {
  const params = useSearchParams()
  const router = useRouter()
  const shop = params.get('shop') || ''
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tab, setTab] = useState<'overview' | 'customers' | 'offers' | 'widget' | 'install'>('overview')
  const [customers, setCustomers] = useState<any[]>([])
  const [offers, setOffers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [newOffer, setNewOffer] = useState({ name: '', description: '', points_required: 500, offer_type: 'percentage', offer_value: '10' })

  useEffect(() => {
    if (!shop) return
    fetch(`/api/widget/config?shop=${shop}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setMerchant(d) })
  }, [shop])

  useEffect(() => {
    if (tab === 'customers') loadCustomers()
    if (tab === 'offers') loadOffers()
  }, [tab])

  async function loadCustomers() {
    const r = await fetch(`/api/merchant/customers?shop=${shop}`)
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

  const widgetSnippet = `<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints.vercel.app'}/widget.js" data-shop="${shop}"></script>`

  if (!shop) return <div className="p-10 text-center text-gray-400">No store specified. <a href="/" className="underline">Go back</a></div>
  if (!merchant) return <div className="p-10 text-center text-gray-400">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="bg-gradient-to-r from-purple-700 to-purple-500 px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">Gold<span className="text-yellow-400">Points</span></span>
          <span className="text-sm bg-white/20 rounded-full px-3 py-1">{merchant.store_name}</span>
        </div>
        <span className="text-sm opacity-70">{shop}</span>
      </header>

      <nav className="flex gap-2 px-8 py-3 bg-[#16162a] border-b border-white/10 flex-wrap">
        {(['overview','customers','offers','widget','install'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm capitalize transition ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{t}</button>
        ))}
      </nav>

      <main className="p-8 max-w-5xl mx-auto">
        {tab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Dashboard</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[['Points/dollar', merchant.points_per_dollar], ['Signup bonus', merchant.signup_bonus + ' pts'], ['Widget', merchant.widget_title], ['Color', merchant.widget_primary_color]].map(([l, v]) => (
                <div key={l as string} className="bg-[#16162a] border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{v}</div>
                  <div className="text-xs text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
              <p className="text-gray-400">Switch to the <strong className="text-white">Customers</strong> tab to see your loyalty members, <strong className="text-white">Offers</strong> to manage rewards, and <strong className="text-white">Widget</strong> to customize your storefront widget.</p>
              <p className="text-gray-400 mt-3">Go to <strong className="text-white">Install</strong> to get the code snippet to add to your Shopify store.</p>
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
              <div><label className="block text-sm text-gray-400 mb-1">Widget Title</label><input value={merchant.widget_title} onChange={e => setMerchant(p => p ? {...p, widget_title: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-full" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Primary Color</label><input type="color" value={merchant.widget_primary_color} onChange={e => setMerchant(p => p ? {...p, widget_primary_color: e.target.value} : p)} className="h-10 w-20 rounded cursor-pointer bg-transparent border-0" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Position</label>
                <select value={merchant.widget_position} onChange={e => setMerchant(p => p ? {...p, widget_position: e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm">
                  <option value="bottom-right">Bottom Right</option><option value="bottom-left">Bottom Left</option>
                </select>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Points per $1 spent</label><input type="number" value={merchant.points_per_dollar} onChange={e => setMerchant(p => p ? {...p, points_per_dollar: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Sign-up bonus points</label><input type="number" value={merchant.signup_bonus} onChange={e => setMerchant(p => p ? {...p, signup_bonus: +e.target.value} : p)} className="bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm w-32" /></div>
              <button onClick={saveSettings} disabled={saving} className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save Settings'}</button>
            </div>
          </div>
        )}

        {tab === 'install' && (
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-6">Install on Your Shopify Store</h2>
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
                  <li>Click <strong>Customize</strong> on your active theme</li>
                  <li>Click <strong>App embeds</strong> (or Edit code → theme.liquid)</li>
                  <li>Paste the snippet just before the <code className="text-purple-400">&lt;/body&gt;</code> tag</li>
                  <li>Save — the widget will appear on every page of your store</li>
                </ol>
              </div>
              <div className="bg-[#16162a] border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">3. Set up the orders webhook (auto-award points)</h3>
                <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                  <li>In Shopify Admin, go to <strong>Settings → Notifications → Webhooks</strong></li>
                  <li>Click <strong>Create webhook</strong></li>
                  <li>Event: <strong>Order creation</strong>, Format: <strong>JSON</strong></li>
                  <li>URL: <code className="text-purple-400 break-all">{process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints.vercel.app'}/api/webhooks/orders</code></li>
                  <li>Save — customers will now earn points automatically on every order</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
