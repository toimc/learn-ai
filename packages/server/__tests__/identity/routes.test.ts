import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { createIdentityRoutes, EmailTakenError } from '@toimc/server'
import type {
  ApiKeyRecord,
  IdentityStore,
  UsageInsert,
  UsageRecord,
  UserPlan,
  UserRecord,
} from '../../src/identity/types'

/**
 * 认证路由契约测试（双盲分工：只依据 docs/guide/server.md 契约表与 identity/types.ts 编写，
 * 不参考任何实现源码）。文档契约：
 * - POST /auth/register：{email, password}（密码 8-128 字符）→ 201 {userId, email, accessToken, expiresIn}；重复邮箱 409
 * - POST /auth/login：→ 200 {userId, email, accessToken, expiresIn}；失败一律 401 {error:'邮箱或密码错误'}
 * - POST /auth/keys：Bearer JWT → 201 {keyId, key, keyPrefix}，明文 key 只此一次，前缀 sk-aichat-
 * - DELETE /auth/keys/:keyId：Bearer JWT → 204；不存在或不属于本人 404
 * - access token 是 HS256 JWT（sub=userId），默认 15 分钟（expiresIn=900）过期
 * - 密码哈希存储格式 scrypt:<salt>:<derived>
 */

const JWT_SECRET = 'blind-test-secret'

/** 内存版 IdentityStore 假实现：数据放 Map，createUser 撞重复邮箱抛 EmailTakenError */
class MemoryIdentityStore implements IdentityStore {
  private usersByEmail = new Map<string, UserRecord>()
  private hashesByUserId = new Map<string, string>()
  private apiKeys = new Map<string, ApiKeyRecord>()
  private keyIdByHash = new Map<string, string>()
  private threadOwners = new Map<string, string>()
  private dailyUsage = new Map<string, number>()
  private usageLog: UsageRecord[] = []
  private seq = 0
  /** 测试观察口：createUser 实际收到的密码哈希 */
  readonly savedHashes: string[] = []

  async createUser(input: {
    email: string
    passwordHash: string
    plan?: UserPlan
  }) {
    if (this.usersByEmail.has(input.email))
      throw new EmailTakenError(input.email)
    this.seq += 1
    const user: UserRecord = {
      id: `user-${this.seq}`,
      email: input.email,
      plan: input.plan ?? 'free',
      createdAt: new Date().toISOString(),
    }
    this.usersByEmail.set(user.email, user)
    this.hashesByUserId.set(user.id, input.passwordHash)
    this.savedHashes.push(input.passwordHash)
    return { ...user }
  }

  async findUserByEmail(email: string) {
    return this.usersByEmail.get(email) ?? null
  }

  async findUserById(id: string) {
    for (const user of this.usersByEmail.values()) {
      if (user.id === id) return user
    }
    return null
  }

  async findPasswordHash(userId: string) {
    return this.hashesByUserId.get(userId) ?? null
  }

  async insertApiKey(userId: string, keyHash: string, keyPrefix: string) {
    this.seq += 1
    const record: ApiKeyRecord = {
      id: `key-${this.seq}`,
      userId,
      keyPrefix,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    this.apiKeys.set(record.id, record)
    this.keyIdByHash.set(keyHash, record.id)
    return { ...record }
  }

  async findUserIdByActiveKeyHash(keyHash: string) {
    const keyId = this.keyIdByHash.get(keyHash)
    if (!keyId) return null
    const record = this.apiKeys.get(keyId)
    if (!record || record.status !== 'active') return null
    return record.userId
  }

  async revokeApiKey(keyId: string, userId: string) {
    const record = this.apiKeys.get(keyId)
    if (!record || record.userId !== userId) return false
    record.status = 'revoked'
    return true
  }

  async claimThread(threadId: string, userId: string) {
    const owner = this.threadOwners.get(threadId)
    if (owner === userId) return true
    if (owner !== undefined) return false
    this.threadOwners.set(threadId, userId)
    return true
  }

  async incrDailyUsage(userId: string, day: string) {
    const key = `${userId}:${day}`
    const next = (this.dailyUsage.get(key) ?? 0) + 1
    this.dailyUsage.set(key, next)
    return next
  }

  async insertUsage(record: UsageInsert) {
    this.usageLog.push({ ...record, id: this.usageLog.length + 1 })
  }

  async listUsage(input: { userId: string; day?: string }) {
    return this.usageLog.filter(
      (row) =>
        row.userId === input.userId &&
        (input.day === undefined || row.createdAt.slice(0, 10) === input.day),
    )
  }
}

function makeApp() {
  const store = new MemoryIdentityStore()
  const app = new Hono()
  // createIdentityRoutes 返回 /register、/login、/keys 等相对路径的子应用，
  // /auth 前缀由挂载方拼（网关里即 basePath + '/auth'）
  app.route('/auth', createIdentityRoutes({ store, jwtSecret: JWT_SECRET }))
  return { app, store }
}

/** 发 JSON 请求；token 存在时带 Bearer 头 */
async function request(
  app: Hono,
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
) {
  const { method = 'POST', body, token } = init
  return app.request(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe('认证路由契约（identity 模式）', () => {
  describe('POST /auth/register', () => {
    it('合法 email 与密码注册返回 201，响应含 userId/email/accessToken/expiresIn=900', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const res = await request(app, '/auth/register', {
        body: { email: 'u1@example.com', password: 'password123' },
      })

      // Assert
      expect(res.status).toBe(201)
      const body = await json(res)
      expect(body.email).toBe('u1@example.com')
      expect(typeof body.userId).toBe('string')
      expect(typeof body.accessToken).toBe('string')
      expect(body.expiresIn).toBe(900)
    })

    it('注册签发的 accessToken 是用入参 jwtSecret 签的 HS256 JWT，sub=userId', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const body = await json(
        await request(app, '/auth/register', {
          body: { email: 'jwt@example.com', password: 'password123' },
        }),
      )

      // Assert：用同一 secret 独立验签（第三方标准库，文档写明 HS256），sub 必须等于响应里的 userId
      const payload = (await verify(
        String(body.accessToken),
        JWT_SECRET,
        'HS256',
      )) as { sub?: unknown }
      expect(payload.sub).toBe(body.userId)
    })

    it('密码过短（7 字符）返回 400', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const res = await request(app, '/auth/register', {
        body: { email: 'short@example.com', password: '1234567' },
      })

      // Assert
      expect(res.status).toBe(400)
    })

    it('邮箱格式非法返回 400', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const res = await request(app, '/auth/register', {
        body: { email: 'not-an-email', password: 'password123' },
      })

      // Assert
      expect(res.status).toBe(400)
    })

    it('重复注册同一邮箱返回 409', async () => {
      // Arrange
      const { app } = makeApp()
      const body = { email: 'dup@example.com', password: 'password123' }
      expect((await request(app, '/auth/register', { body })).status).toBe(201)

      // Act
      const res = await request(app, '/auth/register', { body })

      // Assert
      expect(res.status).toBe(409)
    })

    it('注册把 scrypt:<salt>:<derived> 三段式哈希写入 store', async () => {
      // Arrange
      const { app, store } = makeApp()

      // Act
      const res = await request(app, '/auth/register', {
        body: { email: 'hash@example.com', password: 'password123' },
      })

      // Assert
      expect(res.status).toBe(201)
      expect(store.savedHashes).toHaveLength(1)
      expect(store.savedHashes.join('|')).toMatch(/^scrypt:[^:]+:[^:]+$/)
    })
  })

  describe('POST /auth/login', () => {
    it('正确密码登录返回 200，userId 与注册一致且 expiresIn=900', async () => {
      // Arrange
      const { app } = makeApp()
      const registered = await json(
        await request(app, '/auth/register', {
          body: { email: 'login@example.com', password: 'password123' },
        }),
      )

      // Act
      const res = await request(app, '/auth/login', {
        body: { email: 'login@example.com', password: 'password123' },
      })

      // Assert
      expect(res.status).toBe(200)
      const body = await json(res)
      expect(body.userId).toBe(registered.userId)
      expect(body.email).toBe('login@example.com')
      expect(body.expiresIn).toBe(900)
      expect(typeof body.accessToken).toBe('string')
    })

    it('错误密码返回 401 且 error 为固定文案「邮箱或密码错误」', async () => {
      // Arrange
      const { app } = makeApp()
      await request(app, '/auth/register', {
        body: { email: 'wrong@example.com', password: 'password123' },
      })

      // Act
      const res = await request(app, '/auth/login', {
        body: { email: 'wrong@example.com', password: 'password456' },
      })

      // Assert
      expect(res.status).toBe(401)
      expect(await json(res)).toEqual({ error: '邮箱或密码错误' })
    })

    it('不存在的邮箱返回 401 且文案相同，不泄漏注册状态', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const res = await request(app, '/auth/login', {
        body: { email: 'ghost@example.com', password: 'password123' },
      })

      // Assert
      expect(res.status).toBe(401)
      expect(await json(res)).toEqual({ error: '邮箱或密码错误' })
    })
  })

  describe('POST /auth/keys', () => {
    it('register 签发的 accessToken 可签发 API Key，key 以 sk-aichat- 开头且 keyPrefix 为前 16 字符', async () => {
      // Arrange
      const { app } = makeApp()
      const registered = await json(
        await request(app, '/auth/register', {
          body: { email: 'key1@example.com', password: 'password123' },
        }),
      )

      // Act
      const res = await request(app, '/auth/keys', {
        token: String(registered.accessToken),
      })

      // Assert
      expect(res.status).toBe(201)
      const body = await json(res)
      expect(typeof body.keyId).toBe('string')
      const key = String(body.key)
      expect(key.startsWith('sk-aichat-')).toBe(true)
      expect(body.keyPrefix).toBe(key.slice(0, 16))
    })

    it('login 签发的 accessToken 同样可签发 API Key', async () => {
      // Arrange
      const { app } = makeApp()
      await request(app, '/auth/register', {
        body: { email: 'key2@example.com', password: 'password123' },
      })
      const logged = await json(
        await request(app, '/auth/login', {
          body: { email: 'key2@example.com', password: 'password123' },
        }),
      )

      // Act
      const res = await request(app, '/auth/keys', {
        token: String(logged.accessToken),
      })

      // Assert
      expect(res.status).toBe(201)
      const body = await json(res)
      expect(String(body.key).startsWith('sk-aichat-')).toBe(true)
    })

    it('无鉴权调用返回 401', async () => {
      // Arrange
      const { app } = makeApp()

      // Act
      const res = await request(app, '/auth/keys')

      // Assert
      expect(res.status).toBe(401)
    })

    it('过期的 JWT（exp=1）返回 401', async () => {
      // Arrange：用同 secret 独立签一个早已过期的 token
      const { app } = makeApp()
      const expired = await sign({ sub: 'user-1', exp: 1 }, JWT_SECRET)

      // Act
      const res = await request(app, '/auth/keys', { token: expired })

      // Assert
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /auth/keys/:keyId', () => {
    it('携带 JWT 删除自己的 key 返回 204', async () => {
      // Arrange
      const { app } = makeApp()
      const registered = await json(
        await request(app, '/auth/register', {
          body: { email: 'del@example.com', password: 'password123' },
        }),
      )
      const keyBody = await json(
        await request(app, '/auth/keys', {
          token: String(registered.accessToken),
        }),
      )

      // Act
      const res = await request(app, `/auth/keys/${String(keyBody.keyId)}`, {
        method: 'DELETE',
        token: String(registered.accessToken),
      })

      // Assert
      expect(res.status).toBe(204)
    })

    it('删除不存在的 keyId 返回 404', async () => {
      // Arrange
      const { app } = makeApp()
      const registered = await json(
        await request(app, '/auth/register', {
          body: { email: 'del404@example.com', password: 'password123' },
        }),
      )

      // Act
      const res = await request(app, '/auth/keys/key-does-not-exist', {
        method: 'DELETE',
        token: String(registered.accessToken),
      })

      // Assert
      expect(res.status).toBe(404)
    })
  })
})
