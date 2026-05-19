'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const APP_URL = 'https://goldpoints-shopify.vercel.app'

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
  is_premium: boolean
  custom_from_email: string | null
  resend_domain_id: string | null
  custom_domain_status: string | null
}

interface DnsRecord {
  record: string
  name: string
  type: string
  value: string
  status?: string
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
  const [showAdd, setShowAdd] = useState(false)
  const [newM, setNewM] = useState({ shopify_domain: '', store_name: '', email: '', password: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Cron state
  const [cronRunning, setCronRunning] = useState(false)
  const [cronResult, setCronResult] = useState('')

  // Premium domain drawer state
  const [settingsMerchant, setSettingsMerchant] = useState<Merchant | null>(null)
  const [domainEmail, setDomainEmail] = useState('')
  const [domainRecords, setDomainRecords] = useState<DnsRecord[]>([])
  const [domainStatus, setDomainStatus] = useState('')
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainMsg, setDomainMsg] = useState('')

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

  async function addMerchant() {
    if (!newM.store_name || !newM.email || !newM.password) { setAddError('Store name, email, and password are required.'); return }
    setAdding(true); setAddError('')
    const r = await fetch('/api/admin/merchants/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newM) })
    const d = await r.json()
    if (!r.ok) { setAddError(d.error); setAdding(false); return }
    setNewM({ shopify_domain: '', store_name: '', email: '', password: '' })
    setShowAdd(false); setAdding(false)
    if (d.email_error) alert(`Merchant created but email failed: ${d.email_error}`)
    else alert('Merchant created and welcome email sent!')
    load()
  }

  async function deleteMerchant(id: string, name: string) {
    if (!confirm(`Delete ${name} and all their customer data? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/admin/merchants?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  function openSettings(m: Merchant) {
    setSettingsMerchant(m)
    setDomainEmail(m.custom_from_email || '')
    setDomainRecords([])
    setDomainStatus(m.custom_domain_status || '')
    setDomainMsg('')
    // Auto-load DNS records if domain already added
    if (m.resend_domain_id) {
      fetchDnsRecords(m.id)
    }
  }

  async function fetchDnsRecords(merchantId: string) {
    setDomainLoading(true)
    const r = await fetch(`/api/admin/merchants/domain?merchant_id=${merchantId}`)
    const d = await r.json()
    setDomainRecords(d.records || [])
    setDomainStatus(d.status || '')
    setDomainLoading(false)
  }

  async function addDomain() {
    if (!settingsMerchant || !domainEmail) return
    const domain = domainEmail.split('@')[1]
    if (!domain) { setDomainMsg('Enter a valid email like noreply@yourstore.com'); return }
    setDomainLoading(true); setDomainMsg('')
    const r = await fetch('/api/admin/merchants/domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: settingsMerchant.id, from_email: domainEmail }),
    })
    const d = await r.json()
    if (!r.ok) { setDomainMsg(d.error || 'Failed'); setDomainLoading(false); return }
    setDomainRecords(d.records || [])
    setDomainStatus('pending')
    setDomainMsg('Domain added! Add these DNS records to your domain provider, then click Verify.')
    setDomainLoading(false)
    load()
  }

  async function verifyDomain() {
    if (!settingsMerchant) return
    setDomainLoading(true); setDomainMsg('')
    const r = await fetch('/api/admin/merchants/domain', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_id: settingsMerchant.id }),
    })
    const d = await r.json()
    if (!r.ok) { setDomainMsg(d.error || 'Failed'); setDomainLoading(false); return }
    setDomainRecords(d.records || [])
    setDomainStatus(d.status)
    setDomainMsg(d.status === 'verified' ? '✓ Domain verified! Emails will now send from this address.' : 'DNS not verified yet — check your records and try again.')
    setDomainLoading(false)
    load()
  }

  async function togglePremium(isPremium: boolean) {
    if (!settingsMerchant) return
    await fetch('/api/admin/merchants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: settingsMerchant.id, is_premium: isPremium }),
    })
    setSettingsMerchant(p => p ? { ...p, is_premium: isPremium } : null)
    load()
  }

  async function runCron() {
    setCronRunning(true); setCronResult('')
    const r = await fetch('/api/admin/run-cron', { method: 'POST' })
    const d = await r.json()
    setCronResult(d.error ? `Error: ${d.error}` : `Done — ${d.processed ?? 0} enrollments processed`)
    setCronRunning(false)
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

        {/* Automation Cron */}
        <div className="bg-[#16162a] border border-white/10 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm mb-1">Automation Cron</div>
              <p className="text-xs text-gray-500 mb-2">Vercel Hobby runs this once per day. For hourly execution, add the URL below to <a href="https://cron-job.org" target="_blank" className="text-purple-400 hover:underline">cron-job.org</a> (free) set to every hour.</p>
              <div className="bg-[#0f0f1a] rounded-lg px-3 py-2 text-xs font-mono text-gray-400 break-all">
                https://goldpoints-shopify.vercel.app/api/cron/automations?secret=<span className="text-yellow-400">YOUR_CRON_SECRET</span>
              </div>
              {cronResult && <p className={`text-xs mt-2 ${cronResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{cronResult}</p>}
            </div>
            <button onClick={runCron} disabled={cronRunning} className="shrink-0 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
              {cronRunning ? 'Running...' : 'Run Now'}
            </button>
          </div>
        </div>

        {/* Add Merchant */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-yellow-400">All Merchants</h2>
          <button onClick={() => setShowAdd(p => !p)} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition">
            {showAdd ? 'Cancel' : '+ Add Merchant'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-[#16162a] border border-yellow-500/30 rounded-xl p-5 mb-5">
            <h3 className="font-semibold mb-4 text-sm">Add merchant manually (non-Shopify or pre-onboarding)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Store / Business Name *</label>
                <input value={newM.store_name} onChange={e => setNewM(p => ({...p, store_name: e.target.value}))} placeholder="e.g. Bella Boutique" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Login Email *</label>
                <input type="email" value={newM.email} onChange={e => setNewM(p => ({...p, email: e.target.value}))} placeholder="owner@store.com" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password *</label>
                <input type="password" value={newM.password} onChange={e => setNewM(p => ({...p, password: e.target.value}))} placeholder="Set their login password" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Shopify Domain (optional — they can connect later)</label>
                <input value={newM.shopify_domain} onChange={e => setNewM(p => ({...p, shopify_domain: e.target.value}))} placeholder="mystore.myshopify.com" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              </div>
            </div>
            {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
            <button onClick={addMerchant} disabled={adding} className="mt-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-bold px-5 py-2 rounded-lg transition">
              {adding ? 'Adding...' : 'Create Merchant Account'}
            </button>
          </div>
        )}

        {/* Merchants table */}
        {data.merchants.length === 0 ? (
          <div className="bg-[#16162a] border border-white/10 rounded-xl p-10 text-center text-gray-500">
            No merchants yet. They connect by visiting the homepage and entering their Shopify store.
          </div>
        ) : (
          <div className="bg-[#16162a] border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1f1f3a]">
                <tr>
                  {['Store', 'Domain', 'Members', 'Points', 'pts/$', 'Signup bonus', 'Joined', 'Status', 'Plan', 'Portal', 'Actions'].map(h => (
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
                      {m.is_premium ? (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-900 text-yellow-400">Premium</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-800 text-gray-500">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`${APP_URL}/portal/${encodeURIComponent(m.shopify_domain)}`} target="_blank" className="text-xs text-purple-400 hover:underline">View →</a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openSettings(m)} className="text-xs px-3 py-1 rounded-lg border border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 transition">
                          Settings
                        </button>
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

      {/* Premium Settings Drawer */}
      {settingsMerchant && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setSettingsMerchant(null)} />
          <div className="w-[480px] bg-[#16162a] border-l border-white/10 h-full overflow-y-auto p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{settingsMerchant.store_name}</h2>
                <p className="text-xs text-gray-500">{settingsMerchant.email}</p>
              </div>
              <button onClick={() => setSettingsMerchant(null)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Premium toggle */}
            <div className="bg-[#1f1f3a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="font-semibold text-sm">Premium Plan</div>
                  <div className="text-xs text-gray-500 mt-0.5">Enables sending from a custom domain</div>
                </div>
                <button
                  onClick={() => togglePremium(!settingsMerchant.is_premium)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${settingsMerchant.is_premium ? 'bg-yellow-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settingsMerchant.is_premium ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Custom domain setup */}
            <div className="bg-[#1f1f3a] rounded-xl p-4 flex flex-col gap-4">
              <div>
                <div className="font-semibold text-sm mb-1">Custom From Email</div>
                <div className="text-xs text-gray-500 mb-3">Emails send from this address instead of the shared GoldPoints domain. Example: <span className="text-gray-300">noreply@scarpe.com</span></div>
                <div className="flex gap-2">
                  <input
                    value={domainEmail}
                    onChange={e => setDomainEmail(e.target.value)}
                    placeholder="noreply@yourstore.com"
                    className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500"
                  />
                  <button
                    onClick={addDomain}
                    disabled={domainLoading || !domainEmail}
                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-bold px-4 py-2 rounded-lg transition whitespace-nowrap"
                  >
                    {domainLoading ? '...' : settingsMerchant.resend_domain_id ? 'Re-add' : 'Add Domain'}
                  </button>
                </div>
              </div>

              {/* DNS status badge */}
              {domainStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">DNS status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    domainStatus === 'verified' ? 'bg-green-900 text-green-400' :
                    domainStatus === 'pending' ? 'bg-yellow-900 text-yellow-400' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    {domainStatus === 'verified' ? '✓ Verified' : domainStatus === 'pending' ? 'Pending DNS' : domainStatus}
                  </span>
                  {domainStatus !== 'verified' && settingsMerchant.resend_domain_id && (
                    <button
                      onClick={verifyDomain}
                      disabled={domainLoading}
                      className="text-xs px-3 py-1 rounded-lg border border-purple-500 text-purple-400 hover:bg-purple-500/10 transition disabled:opacity-40"
                    >
                      {domainLoading ? '...' : 'Check Verification'}
                    </button>
                  )}
                </div>
              )}

              {domainMsg && (
                <p className={`text-xs ${domainMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-300'}`}>{domainMsg}</p>
              )}

              {/* DNS records table */}
              {domainRecords.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">DNS Records to add</div>
                  <div className="bg-[#0f0f1a] rounded-lg overflow-hidden border border-white/5">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-3 py-2 text-left text-gray-500">Type</th>
                          <th className="px-3 py-2 text-left text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left text-gray-500">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domainRecords.map((r, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2 text-purple-400 font-mono font-bold whitespace-nowrap">{r.type}</td>
                            <td className="px-3 py-2 text-gray-300 font-mono break-all">{r.name}</td>
                            <td className="px-3 py-2 text-gray-400 font-mono break-all">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Add these in your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.), then click Check Verification above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
