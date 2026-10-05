import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { rateLimit } from '../middleware/rate-limit'
import { issueApiKey } from './api-key'
import { hashPassword, verifyPassword } from './password'
import { requireJwt } from './identify-user'
import { EmailTakenError, type GatewayEnv, type IdentityStore } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128
/** 注册接口 IP 维度防刷（防滥用第一层：批量注册的成本门槛） */
const REGISTER_RATE_LIMIT = { windowMs: 3_600_000, max: 5 }

export interface IdentityRoutesOptions {
  store: IdentityStore
  jwtSecret: string
  /** access token 有效期（秒），默认 900 */
  accessTokenTtlSeconds?: number
  /** 签发时刻注入（epoch 秒；测试过期/有效期用） */
  nowSeconds?: () => number
}

async function signAccessToken(
  userId: string,
  options: IdentityRoutesOptions,
): Promise<{ accessToken: string; expiresIn: number }> {
  const ttl = options.accessTokenTtlSeconds ?? 900
  const issuedAt = (
    options.nowSeconds ?? (() => Math.floor(Date.now() / 1000))
  )()
  const accessToken = await sign(
    { sub: userId, iat: issuedAt, exp: issuedAt + ttl },
    options.jwtSecret,
  )
  return { accessToken, expiresIn: ttl }
}

/**
 * 认证路由（挂 basePath 下 /auth）：
 * - POST /auth/register  {email, password} → 201 + access token（新号即登录态）
 * - POST /auth/login     {email, password} → 200 + access token
 * - POST /auth/keys      （Bearer JWT）→ 201 + 明文 key（只此一次）
 * - DELETE /auth/keys/:keyId（Bearer JWT）→ 204
 * 登录失败一律「邮箱或密码错误」（不泄漏哪个字段错）；错误信息不回显密码。
 */
export function createIdentityRoutes(
  options: IdentityRoutesOptions,
): Hono<GatewayEnv> {
  const app = new Hono<GatewayEnv>()
  const requireAuth = requireJwt(options.jwtSecret)

  app.use('/register', rateLimit(REGISTER_RATE_LIMIT))

  app.post('/register', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown
      password?: unknown
    } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!EMAIL_RE.test(email)) {
      return c.json({ error: '邮箱格式不正确' }, 400)
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return c.json(
        { error: `密码长度需在 ${PASSWORD_MIN}-${PASSWORD_MAX} 字符之间` },
        400,
      )
    }

    let user
    try {
      user = await options.store.createUser({
        email,
        passwordHash: await hashPassword(password),
      })
    } catch (err) {
      if (err instanceof EmailTakenError) {
        return c.json({ error: '该邮箱已被注册' }, 409)
      }
      throw err
    }

    const { accessToken, expiresIn } = await signAccessToken(user.id, options)
    return c.json(
      { userId: user.id, email: user.email, accessToken, expiresIn },
      201,
    )
  })

  app.post('/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown
      password?: unknown
    } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    const user = email ? await options.store.findUserByEmail(email) : null
    const stored = user ? await options.store.findPasswordHash(user.id) : null
    // 用户不存在也走一遍校验（常数响应面，不泄漏注册状态）
    const ok = stored
      ? await verifyPassword(password || '__no-such-password__', stored)
      : false
    if (!user || !ok) {
      return c.json({ error: '邮箱或密码错误' }, 401)
    }

    const { accessToken, expiresIn } = await signAccessToken(user.id, options)
    return c.json({
      userId: user.id,
      email: user.email,
      accessToken,
      expiresIn,
    })
  })

  app.post('/keys', requireAuth, async (c) => {
    const userId = c.get('userId') as string
    const issued = issueApiKey()
    const record = await options.store.insertApiKey(
      userId,
      issued.keyHash,
      issued.keyPrefix,
    )
    return c.json(
      {
        keyId: record.id,
        // 明文 key 只在签发响应里出现一次，库里只有哈希与前缀
        key: issued.key,
        keyPrefix: record.keyPrefix,
      },
      201,
    )
  })

  app.delete('/keys/:keyId', requireAuth, async (c) => {
    const userId = c.get('userId') as string
    const keyId = c.req.param('keyId')
    const revoked = await options.store.revokeApiKey(keyId, userId)
    if (!revoked) return c.json({ error: 'key 不存在或不属于当前用户' }, 404)
    return c.body(null, 204)
  })

  return app
}
