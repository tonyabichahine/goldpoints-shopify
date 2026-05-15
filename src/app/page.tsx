'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [shop, setShop] = useState('')
  const [adminPw, setAdminPw] = useState('')
  const [tab, setTab] = useState<'merchant' | 'admin'>('merchant')
  const router = useRouter()

  function connectShopify() {
    if (!shop) return
    const domain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`
    window.location.href = `/api/auth/install?shop=${domain}`
  }

  function adminLogin() {
    if (adminPw === 'admin123') {
      router.push('/admin')
    } else {
      alert('Wrong password')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-6">
      <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">GoldPoints</div>
      <p className="text-gray-500 mb-10 text-sm">Loyalty rewards for every Shopify merchant</p>

      <div className="w-full max-w-md bg-[#16162a] border border-white/10 rounded-2xl p-8">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('merchant')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab==='merchant'?'bg-purple-600 text-white':'text-gray-400 hover:text-white'}`}>Merchant Login</button>
          <button onClick={() => setTab('admin')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab==='admin'?'bg-purple-600 text-white':'text-gray-400 hover:text-white'}`}>Admin</button>
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

        {tab === 'admin' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Admin password</label>
              <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} onKeyDown={e => e.key==='Enter' && adminLogin()} placeholder="••••••••" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <button onClick={adminLogin} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 py-3 rounded-xl font-semibold text-sm text-black hover:opacity-90 transition">Sign In as Admin</button>
          </div>
        )}
      </div>
    </div>
  )
}
