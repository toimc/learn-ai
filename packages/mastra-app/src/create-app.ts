import type { Mastra } from '@mastra/core'
import { MastraServer } from '@mastra/hono'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { registerAppRoutes } from './app-routes'
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

  // 4111 × 5173 跨源；studio(3000) 的 fetch 带 credentials: 'include'，
  // 通配符 origin 与 credentials 模式互斥（浏览器规范），必须回显具体 origin。
  // 中间件须先于所有路由注册（Hono 按注册顺序执行，晚注册不回溯生效）
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      credentials: true,
    }),
  )

  // 先注册路由（探活始终公开）
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // studio 根路径探活：404 无 CORS 头会被判定为服务不可达
  app.get('/', (c) => c.json({ status: 'ok', server: 'mastra-app' }))

  // 可选 Bearer：复刻 mock-server 语义（401 { error: 'Unauthorized' }）
  if (process.env.MASTRA_APP_TOKEN) {
    app.use('/api/*', bearerAuth([process.env.MASTRA_APP_TOKEN]))
  }

  // 运行时模型路由（/api/app/* 独立前缀，与 MastraServer 的 /api/agents/* 无竞争）
  registerAppRoutes(app)

  // 不设 prefix：保持默认 /api，studio 零 flag 直连
  const server = new MastraServer({ app, mastra })
  await server.init()

  return app
}
