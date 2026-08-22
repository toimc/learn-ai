import type { Mastra } from '@mastra/core'
import { MastraServer } from '@mastra/hono'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bearerAuth } from './bearer-auth'

type App = Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>

/**
 * 组装 Hono 应用：/health → cors → 可选 bearerAuth → @mastra/hono 自动注册 /api/*。
 * 导出工厂供测试用 app.request() 直接调用（不监听端口，mock-server 同款模式）。
 */
export async function createApp(mastra: Mastra): Promise<App> {
  const app: App = new Hono<{
    Bindings: HonoBindings
    Variables: HonoVariables
  }>()

  // 先注册，不受后续中间件影响（健康探活始终公开）
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // 4111 × 5173 跨源
  app.use('/api/*', cors())

  // 可选 Bearer：复刻 mock-server 语义（401 { error: 'Unauthorized' }）
  if (process.env.MASTRA_APP_TOKEN) {
    app.use('/api/*', bearerAuth([process.env.MASTRA_APP_TOKEN]))
  }

  // 不设 prefix：保持默认 /api，studio 零 flag 直连
  const server = new MastraServer({ app, mastra })
  await server.init()

  return app
}
