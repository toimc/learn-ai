import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { IModelAdapter } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'
import { ModelRegistry } from '@toimc/agents'
import { bearerAuth, createChatGateway, rateLimit } from '@toimc/server'
import type { GatewayAuthOptions, GatewayOptions } from '@toimc/server'

const okScript: StreamChunk[] = [
  { type: 'text', content: 'ok' },
  { type: 'done', content: '' },
]

/** 最小可用 fake 适配器（网关集成用，只消费 chatStream） */
function fakeAdapter(script: StreamChunk[]): IModelAdapter {
  return {
    async chat() {
      throw new Error('本测试只消费 chatStream')
    },
    async *chatStream() {
      for (const chunk of script) yield chunk
    },
  }
}

/** 单 fake 模型网关，auth/rateLimit 等选项按需覆盖 */
function makeGateway(overrides: Partial<Omit<GatewayOptions, 'models'>> = {}) {
  const registry = new ModelRegistry().registerAdapter(
    'm1',
    fakeAdapter(okScript),
    {
      name: '模型一',
      description: '演示模型一',
      provider: 'mock',
    },
  )
  return createChatGateway({ models: registry, ...overrides })
}

function postChat(app: Hono, headers: Record<string, string> = {}) {
  return app.request('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('bearerAuth 中间件', () => {
  function makeAuthApp(options: GatewayAuthOptions) {
    const app = new Hono()
    app.use('*', bearerAuth(options))
    app.get('/ping', (c) => c.json({ pong: true }))
    return app
  }

  it('无 Authorization 头返回 401 {error}', async () => {
    const app = makeAuthApp({ tokens: ['s3cret'] })

    const res = await app.request('/ping')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
  })

  it('错误 token 返回 401', async () => {
    const app = makeAuthApp({ tokens: ['s3cret'] })

    const res = await app.request('/ping', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
  })

  it('tokens 集合命中的 token 放行', async () => {
    const app = makeAuthApp({ tokens: ['s3cret'] })

    const res = await app.request('/ping', {
      headers: { authorization: 'Bearer s3cret' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pong: true })
  })

  it('verify 异步校验：正确 token 放行，其余拒绝', async () => {
    const app = makeAuthApp({ verify: async (t) => t === 'x' })

    const ok = await app.request('/ping', {
      headers: { authorization: 'Bearer x' },
    })
    expect(ok.status).toBe(200)

    const bad = await app.request('/ping', {
      headers: { authorization: 'Bearer y' },
    })
    expect(bad.status).toBe(401)
  })
})

describe('rateLimit 中间件', () => {
  it('窗口内超过 max 返回 429 {error}，窗口过期后恢复放行', async () => {
    vi.useFakeTimers()
    const app = new Hono()
    app.use('*', rateLimit({ windowMs: 60000, max: 2, keyBy: () => 'k' }))
    app.get('/ping', (c) => c.json({ pong: true }))

    expect((await app.request('/ping')).status).toBe(200)
    expect((await app.request('/ping')).status).toBe(200)

    const third = await app.request('/ping')
    expect(third.status).toBe(429)
    const body = (await third.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')

    vi.advanceTimersByTime(60001)
    expect((await app.request('/ping')).status).toBe(200)
  })

  it('不同 keyBy 返回值的计数互不影响', async () => {
    vi.useFakeTimers()
    const keys = ['a', 'b', 'a', 'b']
    let i = 0
    const app = new Hono()
    app.use(
      '*',
      rateLimit({ windowMs: 60000, max: 1, keyBy: () => keys[i++] as string }),
    )
    app.get('/ping', (c) => c.json({ pong: true }))

    expect((await app.request('/ping')).status).toBe(200) // key=a 首次
    expect((await app.request('/ping')).status).toBe(200) // key=b 首次，不受 a 计数影响
    expect((await app.request('/ping')).status).toBe(429) // key=a 第二次
    expect((await app.request('/ping')).status).toBe(429) // key=b 第二次
  })
})

describe('网关集成：auth', () => {
  it('/api/chat 无 token 401，带正确 token 200 SSE', async () => {
    const app = makeGateway({ auth: { tokens: ['s3cret'] } })

    const denied = await postChat(app)
    expect(denied.status).toBe(401)

    const allowed = await postChat(app, { authorization: 'Bearer s3cret' })
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('content-type')).toContain('text/event-stream')
    await allowed.text()
  })

  it('/api/health 不受 auth 影响，保持探活开放', async () => {
    const app = makeGateway({ auth: { tokens: ['s3cret'] } })

    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('网关集成：rateLimit', () => {
  it('max 为 1 时第二次 POST /api/chat 返回 429 {error}', async () => {
    vi.useFakeTimers()
    const app = makeGateway({
      rateLimit: { windowMs: 60000, max: 1, keyBy: () => 'gw' },
    })

    const first = await postChat(app)
    expect(first.status).toBe(200)
    await first.text()

    const second = await postChat(app)
    expect(second.status).toBe(429)
    const body = (await second.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
  })
})
