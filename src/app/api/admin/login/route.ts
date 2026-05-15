import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const correct = process.env.ADMIN_PASSWORD || 'admin123'
  if (password !== correct) return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', password, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
  return res
}
