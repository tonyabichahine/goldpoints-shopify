import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('name, merchants(shopify_domain, store_name)')
    .eq('referral_code', code)
    .single()

  if (!customer) redirect('https://goldpoints-shopify.vercel.app')

  const m = (Array.isArray(customer.merchants) ? customer.merchants[0] : customer.merchants) as { shopify_domain: string; store_name: string }
  redirect(`https://${m.shopify_domain}?gp_ref=${code}`)
}
