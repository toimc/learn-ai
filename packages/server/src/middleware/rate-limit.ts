import type { Context } from 'hono'
import type { GatewayMiddleware, GatewayRateLimitOptions } from '../types'

interface Bucket {
  count: number
  resetAt: number
}

/**
 * 内存固定窗口限流：按 key（默认 x-forwarded-for 首段）在 windowMs 内计数，
 * 超过 max 返回 429 `{ error }`。单实例有效，多实例部署需换外部存储。
 */
export function rateLimit(
  options: GatewayRateLimitOptions = {},
): GatewayMiddleware {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 30
  const buckets = new Map<string, Bucket>()

  return async (c, next) => {
    const key = options.keyBy ? options.keyBy(c) : defaultKey(c)
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    bucket.count += 1
    if (bucket.count > max) {
      c.header('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return c.json({ error: 'Too Many Requests' }, 429)
    }
    await next()
  }
}

function defaultKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')
  // 代理链首段是客户端真实 IP；无代理头时退化为全局单桶
  return forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
}
