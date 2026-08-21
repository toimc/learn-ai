import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ModelRegistry } from '@toimc/agents'
import { bearerAuth } from './middleware/auth'
import { rateLimit } from './middleware/rate-limit'
import { createChatRoutes } from './routes/chat'
import { createHealthRoutes } from './routes/health'
import { createModelsRoutes } from './routes/models'
import type { GatewayOptions } from './types'

export function createChatGateway(options: GatewayOptions): Hono {
  const registry =
    options.models instanceof ModelRegistry
      ? options.models
      : options.models.reduce(
          (r, config) => r.register(config),
          new ModelRegistry(),
        )
  const basePath = options.basePath ?? '/api'

  const app = new Hono().basePath(basePath)

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
  if (options.auth) {
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
    }),
  )
  app.route('/models', createModelsRoutes(registry))
  app.route('/health', createHealthRoutes())

  return app
}

function reflectOrigin(origin: string): string {
  return origin || '*'
}
