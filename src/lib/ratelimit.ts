import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _ratelimit: Ratelimit | null = null

function getRatelimit() {
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'gp_rl',
    })
  }
  return _ratelimit
}

export async function checkRateLimit(req: Request): Promise<{ limited: boolean }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { limited: false }
  }
  const ip = (req.headers.get('x-forwarded-for') ?? 'anonymous').split(',')[0].trim()
  const { success } = await getRatelimit().limit(ip)
  return { limited: !success }
}
