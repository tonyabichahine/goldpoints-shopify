'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Merchant {
  id: string
  store_name: string
  shopify_domain: string
  email: string
  active: boolean
  created_at: string
  points_per_dollar: number
  signup_bonus: number
  widget_primary_color: string
}

interface Overview {
  merchants: Merchant[]
  totalCustomers: number
  totalPoints: number
  totalRedemptions: number
  customersByMerchant: Record<string, number>
  pointsByMerchant: Record<string, number>
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/overview')
    if (r.status === 401) { router.push('/'); return }
    setData(await r.json())
    setLoading(false)
  }

  async function toggleMerchant(id: string, active: boolean) {
    await fetch('/api/admin/merchants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !active }) })
    load()
  }

  async function deleteMerchant(id: string, name: string) {
    if (!confirm(`Delete ${name} and all their customer data? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/admin/merchants?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>
  if (!data) return null

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="bg-gradient-to-r from-yellow-700 to-yellow-500 px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">Gold<span className="text-white">Points</span></span>
          <span className="text-sm bg-black/20 rounded-full px-3 py-1">Admin Panel</span>
        </div>
        <button onClick={() => router.push('/')} className="text-sm bg-black/20 hover:bg-black/30 px-4 py-2 rounded-full transition">Sign Out</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            ['Merchants', data.merchants.length, '#c47aff'],
            ['Total Members', data.totalCustomers.toLocaleString(), '#c47aff'],
            ['Points Issued', data.totalPoints.toLocaleString(), '#ffd700'],
            ['Redemptions', data.totalRedemptions.toLocaleString(), '#2ecc71'],
          ].map(([label, val, color]) => (
            <div key={label as string} className="bg-[#16162a] border border-white/10 rounded-xl p-5 text-center">
              <div className="text-2xl font-bold" style={{ color: color as string }}>{val}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Merchants table */}
        <h2 className="text-lg font-bold text-yellow-400 mb-4">All Merchants</h2>
        {data.merchants.length === 0 ? (
          <div className="bg-[#16162a] border border-white/10 rounded-xl p-10 text-center text-gray-500">
            No merchants yet. They connect by visiting the homepage and entering their Shopify store.
          </div>
        ) : (
          <div className="bg-[#16162a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1f1f3a]">
                <tr>
                  {['Store', 'Domain', 'Members', 'Points', 'pts/$', 'Signup bonus', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.merchants.map(m => (
                  <tr key={m.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">{m.store_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.shopify_domain}</td>
                    <td className="px-4 py-3 text-purple-400 font-bold">{data.customersByMerchant[m.id] || 0}</td>
                    <td className="px-4 py-3 text-yellow-400">{(data.pointsByMerchant[m.id] || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{m.points_per_dollar}</td>
                    <td className="px-4 py-3 text-gray-300">{m.signup_bonus}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${m.active ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                        {m.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => toggleMerchant(m.id, m.active)} className={`text-xs px-3 py-1 rounded-lg border transition ${m.active ? 'border-orange-500 text-orange-400 hover:bg-orange-500/10' : 'border-green-500 text-green-400 hover:bg-green-500/10'}`}>
                          {m.active ? 'Pause' : 'Activate'}
                        </button>
                        <button onClick={() => deleteMerchant(m.id, m.store_name)} disabled={deleting === m.id} className="text-xs px-3 py-1 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                          {deleting === m.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
