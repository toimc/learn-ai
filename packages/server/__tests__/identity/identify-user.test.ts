import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { issueApiKey } from '../../src/identity/api-key'
import { identifyUser, requireJwt } from '../../src/identity/identify-user'
import type { GatewayEnv, IdentityStore } from '../../src/identity/types'

const SECRET = 'test-jwt-secret'

/** 最小身份存储替身：API key 哈希表（其余方法本文件不可达） */
function keyStore(
  hashToUser: Record<string, string> = {},
): Pick<IdentityStore, 'findUserIdByActiveKeyHash'> {
  return {
    async findUserIdByActiveKeyHash(keyHash: string) {
      return hashToUser[keyHash] ?? null
    },
  }
}

function makeApp(store: Pick<IdentityStore, 'findUserIdByActiveKeyHash'>) {
  const app = new Hono<GatewayEnv>()
  app.use('*', identifyUser({ store, jwtSecret: SECRET }))
  app.get('/whoami', (c) => c.json({ userId: c.get('userId') as string }))
  return app
}

describe('identifyUser 中间件（API Key 或 JWT 二选一）', () => {
  it('无 Authorization 头返回 401', async () => {
    const res = await makeApp(keyStore()).request('/whoami')
    expect(res.status).toBe(401)
  })

  it('非 Bearer 形态返回 401', async () => {
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: 'Basic abc' },
    })
    expect(res.status).toBe(401)
  })

  it('库中 active 的 API Key 命中：userId 挂进 context', async () => {
    const issued = issueApiKey()
    const app = makeApp(keyStore({ [issued.keyHash]: 'u1' }))
    const res = await app.request('/whoami', {
      headers: { authorization: `Bearer ${issued.key}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'u1' })
  })

  it('库里不存在的 API Key 返回 401', async () => {
    const unknown = issueApiKey()
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: `Bearer ${unknown.key}` },
    })
    expect(res.status).toBe(401)
  })

  it('有效 JWT 放行并把 sub 写入 userId', async () => {
    const token = await sign({ sub: 'u9' }, SECRET)
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'u9' })
  })

  it('过期 JWT 返回 401（exp 已过）', async () => {
    const expired = await sign({ sub: 'u9', exp: 1 }, SECRET)
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: `Bearer ${expired}` },
    })
    expect(res.status).toBe(401)
  })

  it('签名被篡改的 JWT 返回 401', async () => {
    const token = await sign({ sub: 'u9' }, SECRET)
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}xx`
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: `Bearer ${tampered}` },
    })
    expect(res.status).toBe(401)
  })

  it('用错误密钥签发的 JWT 返回 401', async () => {
    const forged = await sign({ sub: 'u9' }, 'other-secret')
    const res = await makeApp(keyStore()).request('/whoami', {
      headers: { authorization: `Bearer ${forged}` },
    })
    expect(res.status).toBe(401)
  })
})

describe('requireJwt 中间件（key 管理只认 JWT）', () => {
  function jwtApp() {
    const app = new Hono<GatewayEnv>()
    app.use('*', requireJwt(SECRET))
    app.get('/me', (c) => c.json({ userId: c.get('userId') as string }))
    return app
  }

  it('有效 JWT 放行', async () => {
    const token = await sign({ sub: 'u2' }, SECRET)
    const res = await jwtApp().request('/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'u2' })
  })

  it('API Key 形态的 token 不被 JWT 路径接受（交给 401，防越权管理 key）', async () => {
    const issued = issueApiKey()
    const res = await jwtApp().request('/me', {
      headers: { authorization: `Bearer ${issued.key}` },
    })
    expect(res.status).toBe(401)
  })
})
