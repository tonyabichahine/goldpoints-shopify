import { NextRequest, NextResponse } from 'next/server'

function isAdmin(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === (process.env.ADMIN_PASSWORD || 'admin123')
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://goldpoints-shopify.vercel.app'
  const secret = process.env.CRON_SECRET
  const url = `${baseUrl}/api/cron/automations${secret ? `?secret=${secret}` : ''}`
  try {
    const r = await fetch(url, { method: 'GET' })
    const d = await r.json()
    return NextResponse.json(d)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
