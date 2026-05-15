import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const pw = req.cookies.get('admin_session')?.value
  if (pw !== (process.env.ADMIN_PASSWORD || 'admin123')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopify_domain, store_name, email } = await req.json()
  if (!shopify_domain || !store_name) return NextResponse.json({ error: 'Domain and store name are required.' }, { status: 400 })

  const domain = shopify_domain.includes('.') ? shopify_domain : `${shopify_domain}.myshopify.com`

  const { data, error } = await supabaseAdmin
    .from('merchants')
    .insert({ shopify_domain: domain, store_name, email: email || null, shopify_access_token: 'manual' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
