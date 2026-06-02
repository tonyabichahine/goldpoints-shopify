import { NextRequest, NextResponse } from 'next/server'
import { signAdminSession, SESSION_COOKIE_OPTS } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  // Rate-limit to stop password brute-forcing
  const { limited } = await checkRateLimit(req)
  if (limited) return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })

  const { password } = await req.json()
  const correct = process.env.ADMIN_PASSWORD || 'admin123'
  if (password !== correct) return NextResponse.json({ error: 'Wrong password' }, { status: 401 })

  // Store a signed token — never the password itself — as the session cookie
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', signAdminSession(), SESSION_COOKIE_OPTS)
  return res
}
