import { createChatGateway } from '@toimc/server'
import { ModelRegistry } from '@toimc/agents'
import { createMockAdapter } from './mock-adapter'
import { createConversationsRoutes } from './routes/conversations'
import { openApiSpec } from './openapi'

/**
 * 组装 mock 演示服务：@toimc/server 网关 + mock 剧本适配器 + 会话演示路由。
 * 线协议与前端 sse-adapter 完全一致（导出供测试用 app.request() 直接调用，不监听端口）。
 */
export function createMockApp() {
  const conversations = createConversationsRoutes()

  const registry = new ModelRegistry()
  registry.registerAdapter('mock-pro', createMockAdapter('pro'), {
    name: 'Mock Pro',
    description: '全场景剧本，默认选择',
  })
  registry.registerAdapter('mock-flash', createMockAdapter('flash'), {
    name: 'Mock Flash',
    description: '同剧本，块间隔更短',
  })
  registry.registerAdapter('mock-thinking', createMockAdapter('thinking'), {
    name: 'Mock Thinking',
    description: '始终先输出思考过程',
  })

  const app = createChatGateway({
    models: registry,
    chat: {
      // 流结束后把这一轮对话写回服务端会话历史（切走再切回仍在）
      onComplete(result) {
        const convId = result.body.conversationId
        if (!convId) return
        const lastUser = [...result.body.messages]
          .reverse()
          .find((m) => m.role === 'user')
        if (!lastUser) return
        conversations.appendExchange(convId, lastUser.content, result.assistant)
      },
    },
  })

  app.route('/conversations', conversations.app)
  app.get('/openapi.json', (c) => c.json(openApiSpec))

  return app
}

export type MockApp = ReturnType<typeof createMockApp>
