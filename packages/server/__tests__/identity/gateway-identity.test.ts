import { describe, expect, it } from 'vitest'
import { sign } from 'hono/jwt'
import type { IModelAdapter } from '@toimc/agents'
import type { ChatRequest } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'
import { ModelRegistry } from '@toimc/agents'
import { createChatGateway, EmailTakenError, issueApiKey } from '@toimc/server'
import type {
  ChatCompletionResult,
  IdentityStore,
  UsageInsert,
  UserRecord,
} from '@toimc/server'

const SECRET = 'it-secret'

/** 内存身份存储替身（行 IDX 索引即可覆盖本文件用例） */
function makeStore() {
  const users = new Map<string, UserRecord & { passwordHash?: string }>()
  const keys = new Map<string, { id: string; userId: string; status: string }>()
  const threads = new Map<string, string>()
  const usage: UsageInsert[] = []
  const daily = new Map<string, number>()
  let seq = 0

  const store: IdentityStore & {
    usageLog: UsageInsert[]
    seedUser: (id: string, plan?: 'free' | 'pro') => void
    seedKey: (userId: string, keyHash: string) => string
  } = {
    usageLog: usage,
    async createUser({ email, passwordHash, plan = 'free' }) {
      if ([...users.values()].some((u) => u.email === email)) {
        throw new EmailTakenError(email)
      }
      const user: UserRecord & { passwordHash?: string } = {
        id: `u${++seq}`,
        email,
        plan,
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordHash,
      }
      users.set(user.id, user)
      return user
    },
    async findUserByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null
    },
    async findUserById(id) {
      const u = users.get(id)
      if (!u) return null
      const rest = {
        id: u.id,
        email: u.email,
        plan: u.plan,
        createdAt: u.createdAt,
      }
      return rest
    },
    async findPasswordHash(userId) {
      return users.get(userId)?.passwordHash ?? null
    },
    async insertApiKey(userId, keyHash, keyPrefix) {
      const id = `k${++seq}`
      keys.set(keyHash, { id, userId, status: 'active' })
      return {
        id,
        userId,
        keyPrefix,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    },
    async findUserIdByActiveKeyHash(keyHash) {
      const k = keys.get(keyHash)
      return k && k.status === 'active' ? k.userId : null
    },
    async revokeApiKey(keyId, userId) {
      for (const [hash, k] of keys) {
        if (k.id === keyId && k.userId === userId) {
          k.status = 'revoked'
          keys.set(hash, k)
          return true
        }
      }
      return false
    },
    async claimThread(threadId, userId) {
      const owner = threads.get(threadId)
      if (owner) return owner === userId
      threads.set(threadId, userId)
      return true
    },
    async incrDailyUsage(userId, day) {
      const key = `${userId}:${day}`
      const next = (daily.get(key) ?? 0) + 1
      daily.set(key, next)
      return next
    },
    async insertUsage(record) {
      usage.push(record)
    },
    async listUsage({ userId }) {
      return usage
        .filter((u) => u.userId === userId)
        .map((u, i) => ({ ...u, id: i + 1 }))
    },
    seedUser(id, plan = 'free') {
      users.set(id, {
        id,
        email: `${id}@t.dev`,
        plan,
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    },
    seedKey(userId, keyHash) {
      const id = `k${++seq}`
      keys.set(keyHash, { id, userId, status: 'active' })
      return id
    },
  }
  return store
}

/** 捕获 passthrough 的剧本适配器：done 帧可带 usage，也可不带 */
function spyAdapter(
  script: StreamChunk[],
  captured: ChatRequest[] = [],
): IModelAdapter {
  return {
    async chat() {
      throw new Error('本测试只消费 chatStream')
    },
    async *chatStream(request) {
      captured.push(request)
      for (const chunk of script) yield chunk
    },
  }
}

const DONE_WITH_USAGE: StreamChunk[] = [
  { type: 'text', content: 'hi' },
  {
    type: 'done',
    content: '',
    metadata: { usage: { inputTokens: 12, outputTokens: 34 } },
  },
]

function makeGateway(
  overrides: {
    script?: StreamChunk[]
    onComplete?: (r: ChatCompletionResult) => void
    identityOverrides?: Record<string, unknown>
  } = {},
) {
  const store = makeStore()
  const captured: ChatRequest[] = []
  const registry = new ModelRegistry().registerAdapter(
    'm1',
    spyAdapter(overrides.script ?? DONE_WITH_USAGE, captured),
    { name: '模型一', description: '演示模型' },
  )
  const app = createChatGateway({
    models: registry,
    identity: {
      store,
      jwtSecret: SECRET,
      ...(overrides.identityOverrides ?? {}),
    },
    ...(overrides.onComplete
      ? { chat: { onComplete: overrides.onComplete } }
      : {}),
  })
  return { app, store, captured }
}

function postChat(
  app: ReturnType<typeof createChatGateway>,
  body: Record<string, unknown>,
  token?: string,
) {
  return app.request('/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('网关 identity 集成：认证与注入', () => {
  it('无 token POST /api/chat 返回 401（不再走静态白名单）', async () => {
    const { app } = makeGateway()
    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res.status).toBe(401)
  })

  it('有效 API Key 放行，且适配器收到的 passthrough.userId=认证身份', async () => {
    const { app, store, captured } = makeGateway()
    store.seedUser('u1')
    const issued = issueApiKey()
    store.seedKey('u1', issued.keyHash)

    const res = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      issued.key,
    )
    expect(res.status).toBe(200)
    await res.text()
    expect(captured[0]?.passthrough?.userId).toBe('u1')
  })

  it('客户端伪造 body.userId 被服务端覆写（透传一律不信任）', async () => {
    const { app, store, captured } = makeGateway()
    store.seedUser('real-user')
    const issued = issueApiKey()
    store.seedKey('real-user', issued.keyHash)

    const res = await postChat(
      app,
      {
        messages: [{ role: 'user', content: 'hi' }],
        userId: 'victim-user',
        conversationId: 'conv-1',
      },
      issued.key,
    )
    expect(res.status).toBe(200)
    await res.text()
    expect(captured[0]?.passthrough?.userId).toBe('real-user')
  })

  it('JWT 也能通过 /api/chat 认证', async () => {
    const { app, store } = makeGateway()
    store.seedUser('jwt-user')
    const token = await sign({ sub: 'jwt-user' }, SECRET)
    const res = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      token,
    )
    expect(res.status).toBe(200)
    await res.text()
  })
})

describe('网关 identity 集成：thread 归属（IDOR 防线）', () => {
  async function userKey(store: ReturnType<typeof makeStore>, userId: string) {
    store.seedUser(userId)
    const issued = issueApiKey()
    store.seedKey(userId, issued.keyHash)
    return issued.key
  }

  it('他人已占有的 conversationId 返回 403 {code: THREAD_FORBIDDEN}', async () => {
    const { app, store } = makeGateway()
    const alice = await userKey(store, 'alice')
    const bob = await userKey(store, 'bob')

    // alice 先用 conv-x 建立归属
    const first = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }], conversationId: 'conv-x' },
      alice,
    )
    expect(first.status).toBe(200)
    await first.text()

    // bob 冒用 conv-x → 403
    const res = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }], conversationId: 'conv-x' },
      bob,
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'Forbidden thread',
      code: 'THREAD_FORBIDDEN',
    })
  })

  it('本人复用自己的 conversationId 正常放行（归属幂等）', async () => {
    const { app, store } = makeGateway()
    const alice = await userKey(store, 'alice')
    for (let i = 0; i < 2; i++) {
      const res = await postChat(
        app,
        {
          messages: [{ role: 'user', content: 'hi' }],
          conversationId: 'conv-own',
        },
        alice,
      )
      expect(res.status).toBe(200)
      await res.text()
    }
  })
})

describe('网关 identity 集成：usage 捕获与配额', () => {
  it('done 帧 metadata.usage 透传到 onComplete 的 result.usage（字面量断言）', async () => {
    const results: ChatCompletionResult[] = []
    const { app, store } = makeGateway({
      onComplete: (r) => results.push(r),
    })
    store.seedUser('u1')
    const issued = issueApiKey()
    store.seedKey('u1', issued.keyHash)

    const res = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      issued.key,
    )
    await res.text()
    expect(results).toHaveLength(1)
    expect(results[0]?.usage).toEqual({ inputTokens: 12, outputTokens: 34 })
  })

  it('适配器不带 usage 的 done 帧：result.usage 为 undefined', async () => {
    const results: ChatCompletionResult[] = []
    const { app, store } = makeGateway({
      script: [
        { type: 'text', content: 'ok' },
        { type: 'done', content: '' },
      ],
      onComplete: (r) => results.push(r),
    })
    store.seedUser('u1')
    const issued = issueApiKey()
    store.seedKey('u1', issued.keyHash)

    const res = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      issued.key,
    )
    await res.text()
    expect(results[0]?.usage).toBeUndefined()
  })

  it('配额 1：第 1 条放行、第 2 条 402（body 含 QUOTA_EXCEEDED 与 quota）', async () => {
    const { app, store } = makeGateway({
      identityOverrides: { freeDailyQuota: 1 },
    })
    store.seedUser('u-quota')
    const issued = issueApiKey()
    store.seedKey('u-quota', issued.keyHash)

    const body = { messages: [{ role: 'user', content: 'hi' }] }
    const first = await postChat(app, body, issued.key)
    expect(first.status).toBe(200)
    await first.text()

    const second = await postChat(app, body, issued.key)
    expect(second.status).toBe(402)
    const json = (await second.json()) as {
      code: string
      quota: number
      upgradeUrl: string
    }
    expect(json.code).toBe('QUOTA_EXCEEDED')
    expect(json.quota).toBe(1)
    expect(json.upgradeUrl).toBe('/pricing')
  })
})
