import jwt from 'jsonwebtoken'
import type { NextRequest } from 'next/server'

// Sessions are signed JWTs so a cookie can't be forged or tampered with.
// Falls back to the service-role key (always set, secret, server-only) when a
// dedicated SESSION_SECRET isn't configured — so existing deploys keep working.
const SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-insecure-secret'
const MAX_AGE_S = 60 * 60 * 24 * 7 // 7 days

export const SESSION_COOKIE_OPTS = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_S,
}

// ── Merchant sessions ──────────────────────────────────────────────────────
export function signMerchantSession(merchantId: string): string {
  return jwt.sign({ mid: merchantId }, SECRET, { expiresIn: '7d' })
}

export function verifyMerchantToken(token: string | undefined): string | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, SECRET) as { mid?: string }
    return payload.mid || null
  } catch {
    return null
  }
}

export function getMerchantId(req: NextRequest): string | null {
  return verifyMerchantToken(req.cookies.get('merchant_session')?.value)
}

// ── Admin session ──────────────────────────────────────────────────────────
export function signAdminSession(): string {
  return jwt.sign({ admin: true }, SECRET, { expiresIn: '7d' })
}

export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false
  try {
    const payload = jwt.verify(token, SECRET) as { admin?: boolean }
    return payload.admin === true
  } catch {
    return false
  }
}
