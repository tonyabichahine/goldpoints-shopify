'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [shop, setShop] = useState('')
  const [customerShop, setCustomerShop] = useState('')
  const [tab, setTab] = useState<'merchant' | 'customer'>('merchant')
  const router = useRouter()

  function connectShopify() {
    if (!shop) return
    const domain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`
    window.location.href = `/api/auth/install?shop=${domain}`
  }

  function goToPortal() {
    if (!customerShop) return
    const domain = customerShop.includes('.myshopify.com') ? customerShop : `${customerShop}.myshopify.com`
    router.push(`/portal/${encodeURIComponent(domain)}`)
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

        {tab === 'customer' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Enter the name of the store you shop at to view your points.</p>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Store domain</label>
              <input value={customerShop} onChange={e => setCustomerShop(e.target.value)} placeholder="yourstore.myshopify.com" onKeyDown={e => e.key === 'Enter' && goToPortal()} className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-yellow-500" />
            </div>
            <button onClick={goToPortal} className="w-full bg-gradient-to-r from-yellow-600 to-yellow-400 py-3 rounded-xl font-semibold text-sm text-black hover:opacity-90 transition">View My Points →</button>
            <p className="text-xs text-gray-600 text-center">Not registered yet? Visit the store and sign up through the rewards widget.</p>
          </div>
        )}
      </div>
    </div>
  )
}
