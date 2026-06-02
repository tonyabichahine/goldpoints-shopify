import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// One limiter instance per (max, window) pairing, each in its own namespace so
// different rates don't share a bucket.
const cache = new Map<string, Ratelimit>()

function getRatelimit(max: number, windowSec: number) {
  const key = `${max}:${windowSec}`
  let rl = cache.get(key)
  if (!rl) {
    rl = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `gp_rl_${max}_${windowSec}`,
    })
    cache.set(key, rl)
  }
  return rl
}

/**
 * Per-IP sliding-window rate limit. Defaults to 5 requests / 60s (login-grade).
 * Pass a higher `max` for customer-facing actions. No-ops if Upstash isn't configured.
 */
export async function checkRateLimit(req: Request, max = 5, windowSec = 60): Promise<{ limited: boolean }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { limited: false }
  }
  const ip = (req.headers.get('x-forwarded-for') ?? 'anonymous').split(',')[0].trim()
  const { success } = await getRatelimit(max, windowSec).limit(ip)
  return { limited: !success }
}
