import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createChatRoutes } from './routes/chat'
import { createConversationsRoutes } from './routes/conversations'

const models = [
  { id: 'mock-pro', name: 'Mock Pro', description: '全场景剧本，默认选择' },
  { id: 'mock-flash', name: 'Mock Flash', description: '同剧本，块间隔更短' },
  {
    id: 'mock-thinking',
    name: 'Mock Thinking',
    description: '始终先输出思考过程',
  },
]

/** 组装 mock 服务（导出供测试用 app.request() 直接调用，不监听端口） */
export function createMockApp() {
  const conversations = createConversationsRoutes()
  const chat = createChatRoutes(conversations)

  const app = new Hono().basePath('/api')

  // 演示服务：放行 VitePress（5173）等本地开发源
  app.use('*', cors())

  app.route('/conversations', conversations.app)
  app.route('/chat', chat)

  app.get('/models', (c) => c.json({ models }))

  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}

export type MockApp = ReturnType<typeof createMockApp>
