import { createMiddleware } from 'hono/factory'
import type { GatewayEnv, IdentityStore } from './types'

/** 免费/pro 每日对话配额缺省值（19-01：free 20 / pro 200） */
export const DEFAULT_DAILY_QUOTA = { free: 20, pro: 200 } as const

export const QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED'
/** 超额引导付费的落地页（前端渲染升级卡片的跳转目标） */
export const UPGRADE_URL = '/pricing'

/** 注入时钟的当日键（UTC 自然日，与笔记口径一致；跨日即翻页重置） */
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** 距下一个 UTC 日零点的秒数（retry-after） */
function secondsUntilTomorrow(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000))
}

/**
 * 每日配额中间件（须挂在 identifyUser 之后）：
 * 原子自增当日计数 → 超 plan 配额返回 402（该付费了）而非 429，
 * 响应体带 upgradeUrl 引导升级，retry-after 告知次日重置时刻。
 * 计数落在 IdentityStore（持久化、重启不清零）。
 */
export function quotaGuard(options: {
  store: Pick<IdentityStore, 'findUserById' | 'incrDailyUsage'>
  free?: number
  pro?: number
  now?: () => Date
}) {
  const freeLimit = options.free ?? DEFAULT_DAILY_QUOTA.free
  const proLimit = options.pro ?? DEFAULT_DAILY_QUOTA.pro

  return createMiddleware<GatewayEnv>(async (c, next) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const user = await options.store.findUserById(userId)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const limit = user.plan === 'pro' ? proLimit : freeLimit
    const now = (options.now ?? (() => new Date()))()
    const used = await options.store.incrDailyUsage(userId, dayKey(now))

    if (used > limit) {
      c.header('retry-after', String(secondsUntilTomorrow(now)))
      return c.json(
        {
          error: `今日${user.plan === 'pro' ? 'Pro' : '免费'}额度已用完，明日重置或升级套餐`,
          code: QUOTA_EXCEEDED_CODE,
          quota: limit,
          upgradeUrl: UPGRADE_URL,
        },
        402,
      )
    }
    c.set('quotaRemaining', limit - used)
    await next()
  })
}
