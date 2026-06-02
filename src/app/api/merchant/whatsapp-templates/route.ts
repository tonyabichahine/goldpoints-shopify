import { NextRequest, NextResponse } from 'next/server'
import { verifyMerchantToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function getMerchantWithWA(merchantId: string) {
  const { data } = await supabaseAdmin
    .from('merchants')
    .select('is_premium, whatsapp_waba_id, whatsapp_token')
    .eq('id', merchantId)
    .single()
  return data
}

export async function GET(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const merchant = await getMerchantWithWA(merchantId)
  if (!merchant?.is_premium) return NextResponse.json({ error: 'Premium plan required' }, { status: 403 })

  const { name, category, body } = await req.json()

  if (!name || !body) return NextResponse.json({ error: 'Name and body are required' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(name)) return NextResponse.json({ error: 'Name must be lowercase letters, numbers, and underscores only' }, { status: 400 })

  // Save draft first so we have a record even if Meta call fails
  const { data: template, error: dbErr } = await supabaseAdmin
    .from('whatsapp_templates')
    .insert({ merchant_id: merchantId, name, category: category || 'MARKETING', body, status: 'draft' })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Submit to Meta if credentials are configured
  if (merchant.whatsapp_waba_id && merchant.whatsapp_token) {
    try {
      const varMatches = body.match(/\{\{\d+\}\}/g) || []
      const varCount = new Set(varMatches).size
      const sampleValues = ['Alex', 'Your Store', '420', 'Gold'].slice(0, varCount)

      const metaRes = await fetch(`https://graph.facebook.com/v18.0/${merchant.whatsapp_waba_id}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${merchant.whatsapp_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          language: 'en_US',
          category: category || 'MARKETING',
          components: [{
            type: 'BODY',
            text: body,
            ...(varCount > 0 ? { example: { body_text: [sampleValues] } } : {}),
          }],
        }),
      })

      const metaData = await metaRes.json()

      if (metaRes.ok && metaData.id) {
        await supabaseAdmin.from('whatsapp_templates')
          .update({ status: 'PENDING', meta_template_id: String(metaData.id) })
          .eq('id', template.id)
        return NextResponse.json({ ...template, status: 'PENDING', meta_template_id: metaData.id })
      } else {
        const reason = metaData.error?.message || JSON.stringify(metaData)
        await supabaseAdmin.from('whatsapp_templates')
          .update({ status: 'error', rejection_reason: reason })
          .eq('id', template.id)
        return NextResponse.json({ ...template, status: 'error', meta_error: reason }, { status: 422 })
      }
    } catch (e: any) {
      await supabaseAdmin.from('whatsapp_templates')
        .update({ status: 'error', rejection_reason: e.message })
        .eq('id', template.id)
      return NextResponse.json({ ...template, status: 'error', meta_error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json(template)
}

// PATCH — sync statuses from Meta
export async function PATCH(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const merchant = await getMerchantWithWA(merchantId)
  if (!merchant?.whatsapp_waba_id || !merchant?.whatsapp_token) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
  }

  const { data: templates } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .not('status', 'in', '("APPROVED","draft")')

  if (!templates?.length) return NextResponse.json({ synced: 0 })

  let synced = 0
  for (const t of templates) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${merchant.whatsapp_waba_id}/message_templates?name=${t.name}&fields=id,name,status,rejected_reason`,
        { headers: { Authorization: `Bearer ${merchant.whatsapp_token}` } }
      )
      const data = await res.json()
      const mt = data.data?.[0]
      if (mt?.status) {
        await supabaseAdmin.from('whatsapp_templates').update({
          status: mt.status,
          rejection_reason: mt.rejected_reason || null,
          meta_template_id: String(mt.id),
        }).eq('id', t.id)
        synced++
      }
    } catch {}
  }

  return NextResponse.json({ synced })
}

export async function DELETE(req: NextRequest) {
  const merchantId = verifyMerchantToken(req.cookies.get('merchant_session')?.value)
  if (!merchantId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: template } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('name')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const merchant = await getMerchantWithWA(merchantId)
  if (merchant?.whatsapp_waba_id && merchant?.whatsapp_token) {
    await fetch(`https://graph.facebook.com/v18.0/${merchant.whatsapp_waba_id}/message_templates?name=${template.name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${merchant.whatsapp_token}` },
    }).catch(() => {})
  }

  await supabaseAdmin.from('whatsapp_templates').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
