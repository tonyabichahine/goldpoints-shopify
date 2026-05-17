'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => { if (!token) setError('Invalid reset link.') }, [token])

  async function handleSubmit() {
    if (!password || password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const r = await fetch('/api/merchant/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error); return }
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#16162a] border border-white/10 rounded-2xl p-8">
        <div className="text-2xl font-extrabold mb-1">
          <span className="text-purple-400">Gold</span><span className="text-yellow-400">Points</span>
        </div>
        <p className="text-gray-500 text-sm mb-6">Merchant dashboard</p>

        {done ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="font-semibold text-lg mb-2">Password updated!</p>
            <p className="text-gray-400 text-sm mb-6">You can now log in with your new password.</p>
            <button onClick={() => router.push('/')} className="bg-gradient-to-r from-purple-700 to-purple-500 text-white font-bold px-6 py-3 rounded-xl text-sm">
              Go to Login →
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-1">Reset Password</h1>
            <p className="text-gray-400 text-sm mb-5">Enter a new password for your merchant account.</p>
            <label className="block text-xs text-gray-400 mb-1">New Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 mb-3"
            />
            <label className="block text-xs text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full bg-[#0f0f1a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 mb-4"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full bg-gradient-to-r from-purple-700 to-purple-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {loading ? 'Saving...' : 'Set New Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetMerchantPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">Loading...</div>}>
      <ResetForm />
    </Suspense>
  )
}
