import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ModelRegistry } from '@toimc/agents'
import { bearerAuth } from './middleware/auth'
import { rateLimit } from './middleware/rate-limit'
import { identifyUser } from './identity/identify-user'
import { quotaGuard } from './identity/quota-guard'
import { createIdentityRoutes } from './identity/routes'
import type { GatewayEnv } from './identity/types'
import { createChatRoutes } from './routes/chat'
import { createHealthRoutes } from './routes/health'
import { createModelsRoutes } from './routes/models'
import type { GatewayOptions } from './types'

/**
 * 公共返回类型保持裸 Hono（Env 泛型在中间件/路由内部生效）——
 * 显式 GatewayEnv 会让既有宿主的 Hono 形参类型不变协而破坏编译。
 */
export function createChatGateway(options: GatewayOptions): Hono {
  const registry =
    options.models instanceof ModelRegistry
      ? options.models
      : options.models.reduce(
          (r, config) => r.register(config),
          new ModelRegistry(),
        )
  const basePath = options.basePath ?? '/api'

  const app = new Hono<GatewayEnv>().basePath(basePath)

  // 中间件层：CORS（默认反射 Origin，等效宽松但兼容未来 credentials）→ 日志（可选）
  if (options.cors !== false) {
    const corsOptions =
      options.cors == null || options.cors === true
        ? { origin: reflectOrigin }
        : options.cors
    app.use('*', cors(corsOptions))
  }
  if (options.logging) app.use('*', logger())

  // 认证与限流只挂业务路由，/health 保持开放（探活不应被锁）
  if (options.identity) {
    // 用户态（19 章）：API Key/JWT 识别用户，/auth 挂注册登录与 key 管理，
    // /chat 上叠加每日配额（在识别之后）；auth 静态白名单此时不再生效
    const { identity } = options
    const identify = identifyUser({
      store: identity.store,
      jwtSecret: identity.jwtSecret,
    })
    app.use('/chat', identify)
    app.use('/models', identify)
    app.use(
      '/chat',
      quotaGuard({
        store: identity.store,
        free: identity.freeDailyQuota,
        pro: identity.proDailyQuota,
        ...(identity.now ? { now: identity.now } : {}),
      }),
    )
    app.route(
      '/auth',
      createIdentityRoutes({
        store: identity.store,
        jwtSecret: identity.jwtSecret,
        ...(identity.accessTokenTtlSeconds
          ? { accessTokenTtlSeconds: identity.accessTokenTtlSeconds }
          : {}),
      }),
    )
  } else if (options.auth) {
    const auth = bearerAuth(options.auth)
    app.use('/chat', auth)
    app.use('/models', auth)
  }
  if (options.rateLimit) {
    const limit = rateLimit(options.rateLimit)
    app.use('/chat', limit)
    app.use('/models', limit)
  }

  app.route(
    '/chat',
    createChatRoutes({
      registry,
      defaultModel: options.defaultModel,
      onComplete: options.chat?.onComplete,
      ...(options.identity
        ? { identity: { store: options.identity.store } }
        : {}),
    }),
  )
  app.route('/models', createModelsRoutes(registry))
  app.route('/health', createHealthRoutes())

  // 擦除 Env 泛型返回裸 Hono：运行时同一实例，仅避免下游裸 Hono 形参不变协
  return app as unknown as Hono
}

function reflectOrigin(origin: string): string {
  return origin || '*'
}
