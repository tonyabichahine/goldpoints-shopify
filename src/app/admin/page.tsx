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
  whatsapp_credits: number
  whatsapp_phone_number_id: string | null
  whatsapp_waba_id: string | null
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
  const [cronStatus, setCronStatus] = useState<{ enabled?: boolean; nextExecution?: number; lastExecution?: number; lastStatus?: number; lastDuration?: number; lastHttpStatus?: number } | null>(null)
  const [enrollmentStats, setEnrollmentStats] = useState<{ errorCount: number; activeCount: number } | null>(null)
  const [resettingErrors, setResettingErrors] = useState(false)

  // Deleted customers
  const [deletedCustomers, setDeletedCustomers] = useState<any[]>([])
  const [deletedLoading, setDeletedLoading] = useState(false)
  const [deletedActing, setDeletedActing] = useState<string | null>(null)

  // Premium domain drawer state
  const [settingsMerchant, setSettingsMerchant] = useState<Merchant | null>(null)
  const [domainEmail, setDomainEmail] = useState('')
  const [domainRecords, setDomainRecords] = useState<DnsRecord[]>([])
  const [domainStatus, setDomainStatus] = useState('')
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainMsg, setDomainMsg] = useState('')
  const [addCredits, setAddCredits] = useState('')
  const [creditsMsg, setCreditsMsg] = useState('')
  const [waPhoneId, setWaPhoneId] = useState('')
  const [waWabaId, setWaWabaId] = useState('')
  const [waToken, setWaToken] = useState('')
  const [waSaving, setWaSaving] = useState(false)
  const [waMsg, setWaMsg] = useState('')
  const [loginPw, setLoginPw] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => { load(); loadCronStatus(); loadEnrollmentStats(); loadDeletedCustomers() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/overview')
    if (r.status === 401) { setLoading(false); return }
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

  async function loadCronStatus() {
    const r = await fetch('/api/admin/cron-status')
    if (r.ok) setCronStatus(await r.json())
  }

  async function loadEnrollmentStats() {
    const r = await fetch('/api/admin/enrollments')
    if (r.ok) setEnrollmentStats(await r.json())
  }

  async function runCron() {
    setCronRunning(true); setCronResult('')
    const r = await fetch('/api/admin/run-cron', { method: 'POST' })
    const d = await r.json()
    setCronResult(d.error ? `Error: ${d.error}` : `Done — ${d.processed ?? 0} enrollments processed`)
    setCronRunning(false)
    loadCronStatus(); loadEnrollmentStats()
  }

  async function loadDeletedCustomers() {
    setDeletedLoading(true)
    const r = await fetch('/api/admin/deleted-customers')
    if (r.ok) setDeletedCustomers(await r.json())
    setDeletedLoading(false)
  }

  async function actOnDeletedCustomer(id: string, action: 'restore' | 'delete') {
    if (action === 'delete' && !confirm('Permanently delete this customer? This cannot be undone.')) return
    setDeletedActing(id)
    await fetch('/api/admin/deleted-customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setDeletedActing(null)
    loadDeletedCustomers()
    load()
  }

  async function resetErrors() {
    setResettingErrors(true)
    await fetch('/api/admin/enrollments', { method: 'PATCH' })
    setResettingErrors(false)
    loadEnrollmentStats()
  }

  async function doLogin() {
    setLoginLoading(true); setLoginErr('')
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: loginPw }) })
    if (!r.ok) { setLoginErr('Wrong password.'); setLoginLoading(false); return }
    setAuthed(true); setLoginLoading(false); load()
  }

  if (!authed && !data && !loading) return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
      <div className="bg-[#16162a] border border-white/10 rounded-2xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-yellow-400 text-center">GoldPoints Admin</h1>
        <input
          type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLogin()}
          placeholder="Enter admin password"
          className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-yellow-500"
        />
        {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}
        <button onClick={doLogin} disabled={loginLoading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold py-2 rounded-lg text-sm">
          {loginLoading ? 'Logging in...' : 'Log In'}
        </button>
      </div>
    </div>
  )
  if (loading || !data) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>

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
              <div className="flex items-center gap-2 mb-2">
                <div className="font-semibold text-sm">Automation Cron</div>
                {cronStatus && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cronStatus.enabled ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                    {cronStatus.enabled ? '● Hourly' : '○ Paused'}
                  </span>
                )}
              </div>
              {cronStatus ? (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-[#0f0f1a] rounded-lg px-3 py-2 text-center">
                    <div className={`text-sm font-bold ${cronStatus.lastStatus === 1 ? 'text-green-400' : cronStatus.lastStatus === 0 && cronStatus.lastExecution === 0 ? 'text-gray-500' : 'text-red-400'}`}>
                      {cronStatus.lastStatus === 1 ? '✓ OK' : cronStatus.lastExecution === 0 ? 'Never ran' : '✗ Failed'}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">Last result</div>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-lg px-3 py-2 text-center">
                    <div className="text-sm font-bold text-gray-300">
                      {cronStatus.lastExecution ? new Date(cronStatus.lastExecution * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">Last ran</div>
                  </div>
                  <div className="bg-[#0f0f1a] rounded-lg px-3 py-2 text-center">
                    <div className="text-sm font-bold text-gray-300">
                      {cronStatus.nextExecution ? new Date(cronStatus.nextExecution * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">Next run</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mb-2">Loading cron status...</p>
              )}
              {enrollmentStats && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500">{enrollmentStats.activeCount} active enrollments</span>
                  {enrollmentStats.errorCount > 0 && (
                    <>
                      <span className="text-xs text-red-400 font-semibold">{enrollmentStats.errorCount} stuck (errored)</span>
                      <button onClick={resetErrors} disabled={resettingErrors} className="text-xs px-2 py-0.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                        {resettingErrors ? '...' : 'Reset'}
                      </button>
                    </>
                  )}
                </div>
              )}
              {cronResult && <p className={`text-xs mt-1 ${cronResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{cronResult}</p>}
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
          <div className="bg-[#16162a] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
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
        {/* Deleted Customers Log */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-red-400">Deleted Customers Log</h2>
            <span className="text-xs text-gray-500">{deletedCustomers.length} total</span>
          </div>
          {deletedLoading ? (
            <div className="text-gray-500 text-sm py-4">Loading...</div>
          ) : deletedCustomers.length === 0 ? (
            <div className="bg-[#16162a] border border-white/10 rounded-xl p-8 text-center text-gray-500 text-sm">
              No deleted customers.
            </div>
          ) : (
            <div className="bg-[#16162a] border border-white/10 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-[#1f1f3a]">
                  <tr>
                    {['Store', 'Name', 'Email', 'Points', 'Tier', 'Deleted At', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deletedCustomers.map((c: any) => (
                    <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-yellow-400 font-semibold text-xs">{c.merchants?.store_name || '—'}</td>
                      <td className="px-4 py-3">{c.name || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-gray-400">{c.email}</td>
                      <td className="px-4 py-3 text-yellow-300">{c.points?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          c.tier === 'Gold' ? 'bg-yellow-900 text-yellow-400' :
                          c.tier === 'Silver' ? 'bg-gray-700 text-gray-300' :
                          'bg-orange-900/40 text-orange-400'
                        }`}>{c.tier || 'Bronze'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.deleted_at).toLocaleDateString()} {new Date(c.deleted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => actOnDeletedCustomer(c.id, 'restore')}
                            disabled={deletedActing === c.id}
                            className="text-xs px-3 py-1 rounded-lg border border-green-500 text-green-400 hover:bg-green-500/10 transition disabled:opacity-40"
                          >
                            {deletedActing === c.id ? '...' : 'Restore'}
                          </button>
                          <button
                            onClick={() => actOnDeletedCustomer(c.id, 'delete')}
                            disabled={deletedActing === c.id}
                            className="text-xs px-3 py-1 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                          >
                            {deletedActing === c.id ? '...' : 'Delete Forever'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

            {/* WhatsApp Credits */}
            <div className="bg-[#1f1f3a] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">💬 WhatsApp Credits</div>
                <div className="text-lg font-bold text-green-400">{settingsMerchant.whatsapp_credits ?? 0}</div>
              </div>
              <div className="flex gap-2">
                <input
                  type="number" min={1} placeholder="Credits to add" value={addCredits}
                  onChange={e => setAddCredits(e.target.value)}
                  className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <button
                  onClick={async () => {
                    const n = parseInt(addCredits)
                    if (!n || n <= 0) return
                    await fetch('/api/admin/merchants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: settingsMerchant.id, add_whatsapp_credits: n }) })
                    setSettingsMerchant(m => m ? { ...m, whatsapp_credits: (m.whatsapp_credits || 0) + n } : m)
                    setAddCredits('')
                    setCreditsMsg(`+${n} credits added`)
                    setTimeout(() => setCreditsMsg(''), 3000)
                    load()
                  }}
                  className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >Add</button>
              </div>
              {creditsMsg && <p className="text-xs text-green-400">{creditsMsg}</p>}
            </div>

            {/* WhatsApp API Credentials */}
            <div className="bg-[#1f1f3a] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">WhatsApp API Setup</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${settingsMerchant.whatsapp_phone_number_id ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {settingsMerchant.whatsapp_phone_number_id ? '✓ Connected' : 'Not configured'}
                </span>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone Number ID</label>
                <input
                  value={waPhoneId}
                  onChange={e => setWaPhoneId(e.target.value)}
                  placeholder={settingsMerchant.whatsapp_phone_number_id ? '(already set — paste to replace)' : '1234567890'}
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">WhatsApp Business Account ID (WABA ID)</label>
                <input
                  value={waWabaId}
                  onChange={e => setWaWabaId(e.target.value)}
                  placeholder={settingsMerchant.whatsapp_waba_id ? '(already set — paste to replace)' : '9876543210'}
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">Found in Meta Business → WhatsApp → Accounts</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Access Token</label>
                <input
                  type="password"
                  value={waToken}
                  onChange={e => setWaToken(e.target.value)}
                  placeholder="EAAxxxxxxx…"
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              {waMsg && <p className={`text-xs ${waMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{waMsg}</p>}
              <button
                disabled={waSaving || (!waPhoneId && !waWabaId && !waToken)}
                onClick={async () => {
                  setWaSaving(true); setWaMsg('')
                  const body: Record<string, string> = { id: settingsMerchant.id }
                  if (waPhoneId) body.whatsapp_phone_number_id = waPhoneId
                  if (waWabaId) body.whatsapp_waba_id = waWabaId
                  if (waToken) body.whatsapp_token = waToken
                  const r = await fetch('/api/admin/merchants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                  setWaSaving(false)
                  if (r.ok) {
                    if (waPhoneId) setSettingsMerchant(m => m ? { ...m, whatsapp_phone_number_id: waPhoneId } : m)
                    if (waWabaId) setSettingsMerchant(m => m ? { ...m, whatsapp_waba_id: waWabaId } : m)
                    setWaPhoneId(''); setWaWabaId(''); setWaToken('')
                    setWaMsg('✓ Credentials saved')
                    setTimeout(() => setWaMsg(''), 3000)
                  } else { setWaMsg('Save failed') }
                }}
                className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-40 py-2 rounded-lg text-sm font-semibold transition"
              >
                {waSaving ? 'Saving…' : 'Save WhatsApp Credentials'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
