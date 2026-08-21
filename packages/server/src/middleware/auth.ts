import type { GatewayAuthOptions, GatewayMiddleware } from '../types'

/**
 * Bearer 认证中间件：`Authorization: Bearer <token>`。
 * tokens 集合命中或 verify 返回 true 放行；缺失/不匹配返回 401 `{ error }`。
 */
export function bearerAuth(options: GatewayAuthOptions): GatewayMiddleware {
  return async (c, next) => {
    const header = c.req.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const ok = token
      ? options.verify
        ? await options.verify(token)
        : (options.tokens ?? []).includes(token)
      : false
    if (!ok) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  }
}
