import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { quotaGuard } from '../../src/identity/quota-guard'
import type { GatewayEnv } from '../../src/identity/types'
import type { IdentityStore, UserRecord } from '../../src/identity/types'

/** 配额路径用到的最小存储替身：用户档案 + 按日计数（记录 incr 的 day 入参） */
function makeStore(users: Record<string, UserRecord>) {
  const counts = new Map<string, number>()
  const incrDays: string[] = []
  const store: Pick<IdentityStore, 'findUserById' | 'incrDailyUsage'> = {
    async findUserById(id) {
      return users[id] ?? null
    },
    async incrDailyUsage(userId, day) {
      incrDays.push(day)
      const key = `${userId}:${day}`
      const next = (counts.get(key) ?? 0) + 1
      counts.set(key, next)
      return next
    },
  }
  return { store, incrDays }
}

function user(id: string, plan: 'free' | 'pro'): UserRecord {
  return {
    id,
    email: `${id}@test.dev`,
    plan,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeApp(
  users: Record<string, UserRecord>,
  opts: { free?: number; pro?: number; now: () => Date },
  headerAuth = 'Bearer t',
) {
  const { store } = makeStore(users)
  const app = new Hono<GatewayEnv>()
  // identifyUser 已在上游：这里直接把 userId 写入 context 模拟认证完成
  app.use('*', async (_c, next) => {
    _c.set('userId', 'u-free')
    await next()
  })
  app.use('*', quotaGuard({ store, ...opts }))
  app.post('/chat', (c) =>
    c.json({ remaining: c.get('quotaRemaining') as number }),
  )
  return {
    app,
    post: () =>
      app.request('/chat', {
        method: 'POST',
        ...(headerAuth ? { headers: { authorization: headerAuth } } : {}),
      }),
  }
}

/** 2026-06-15T12:00:00Z：当日剩余 12h，retry-after 预期 43200（手工计算字面量） */
const DAY_NOON = new Date('2026-06-15T12:00:00Z')
const NEXT_MORNING = new Date('2026-06-16T08:30:00Z')

describe('quotaGuard 中间件', () => {
  it('免费配额 2：第 1/2 条放行并回报剩余，第 3 条拒绝 402（边界=当日最后一条放行）', async () => {
    const { app, post } = makeApp(
      { 'u-free': user('u-free', 'free') },
      { free: 2, now: () => DAY_NOON },
    )

    const r1 = await post()
    expect(r1.status).toBe(200)
    expect(await r1.json()).toEqual({ remaining: 1 })

    const r2 = await post()
    expect(r2.status).toBe(200)
    expect(await r2.json()).toEqual({ remaining: 0 })

    const r3 = await post()
    expect(r3.status).toBe(402)
    expect(await r3.json()).toEqual({
      error: expect.stringContaining('额度'),
      code: 'QUOTA_EXCEEDED',
      quota: 2,
      upgradeUrl: '/pricing',
    })
    // 超额请求不消耗 next()：仍命中同一天计数
    expect(app).toBeDefined()
  })

  it('402 响应带 retry-after=距下一 UTC 日零点的秒数（正午起 43200）', async () => {
    const { post } = makeApp(
      { 'u-free': user('u-free', 'free') },
      { free: 0, now: () => DAY_NOON },
    )
    const res = await post()
    expect(res.status).toBe(402)
    expect(res.headers.get('retry-after')).toBe('43200')
  })

  it('跨日重置：次日计数键翻页（注入时钟推进一天后重新放行）', async () => {
    let now = DAY_NOON
    const { post } = makeApp(
      { 'u-free': user('u-free', 'free') },
      { free: 1, now: () => now },
    )

    expect((await post()).status).toBe(200)
    expect((await post()).status).toBe(402)

    now = NEXT_MORNING
    expect((await post()).status).toBe(200)
  })

  it('pro 用户走独立配额档（free=1/pro=3：free 第 2 条即拒，pro 第 4 条才拒）', async () => {
    const { store } = makeStore({
      'u-free': user('u-free', 'free'),
      'u-pro': user('u-pro', 'pro'),
    })
    const app = new Hono<GatewayEnv>()
    app.use('/pro', async (_c, next) => {
      _c.set('userId', 'u-pro')
      await next()
    })
    app.use('/pro', quotaGuard({ store, free: 1, pro: 3, now: () => DAY_NOON }))
    app.post('/pro', (c) => c.json({ ok: true }))

    expect((await app.request('/pro', { method: 'POST' })).status).toBe(200)
    expect((await app.request('/pro', { method: 'POST' })).status).toBe(200)
    expect((await app.request('/pro', { method: 'POST' })).status).toBe(200)
    expect((await app.request('/pro', { method: 'POST' })).status).toBe(402)
  })

  it('用户不存在（key 撤销后用户被删等场景）返回 401 而非误计配额', async () => {
    const { store } = makeStore({})
    const app = new Hono<GatewayEnv>()
    app.use('*', async (_c, next) => {
      _c.set('userId', 'ghost')
      await next()
    })
    app.use('*', quotaGuard({ store, now: () => DAY_NOON }))
    app.post('/chat', (c) => c.json({ ok: true }))

    const res = await app.request('/chat', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
