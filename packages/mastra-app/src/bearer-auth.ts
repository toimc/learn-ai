import type { Context, MiddlewareHandler, Next } from 'hono'

/**
 * Bearer 认证中间件：`Authorization: Bearer <token>` 命中放行；
 * 缺失/不匹配返回 401 `{ error: 'Unauthorized' }`。
 * 复刻 @toimc/server 的 bearerAuth 语义（spec 12 §3.2）；本包禁引 @toimc/*，故本地实现。
 */
export function bearerAuth(tokens: string[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const header = c.req.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token || !tokens.includes(token)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  }
}
