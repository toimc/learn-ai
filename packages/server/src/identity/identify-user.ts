import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { API_KEY_PREFIX, verifyApiKey } from './api-key'
import type { GatewayEnv, IdentityStore } from './types'

/** Bearer 头提取（与既有 bearerAuth 同口径） */
function bearerToken(header: string): string {
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

/** JWT 校验：过期/签名不对/格式非法抛错转 null，payload.sub 收窄成 userId */
async function readJwtSub(
  token: string,
  jwtSecret: string,
): Promise<string | null> {
  try {
    const payload = await verify(token, jwtSecret, 'HS256')
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * 用户识别中间件：`Authorization: Bearer <API Key|JWT>` → c.set('userId')。
 * API Key（sk-aichat- 前缀）面向程序，JWT 面向人，同一入口归一到 userId；
 * userId 贯穿四站：认证 → 配额 → 会话隔离 → 用量记账。
 */
export function identifyUser(options: {
  store: Pick<IdentityStore, 'findUserIdByActiveKeyHash'>
  jwtSecret: string
}) {
  return createMiddleware<GatewayEnv>(async (c, next) => {
    const token = bearerToken(c.req.header('authorization') ?? '')
    const userId = !token
      ? null
      : token.startsWith(API_KEY_PREFIX)
        ? await verifyApiKey(token, options.store)
        : await readJwtSub(token, options.jwtSecret)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', userId)
    await next()
  })
}

/** key 管理（签发/撤销）只认短时效 JWT——API Key 不应能繁殖 key */
export function requireJwt(jwtSecret: string) {
  return createMiddleware<GatewayEnv>(async (c, next) => {
    const token = bearerToken(c.req.header('authorization') ?? '')
    const userId =
      token && !token.startsWith(API_KEY_PREFIX)
        ? await readJwtSub(token, jwtSecret)
        : null
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', userId)
    await next()
  })
}
