import { createMastraGateway } from '@toimc/server/mastra'
import { ModelRegistry } from '@toimc/agents'
import { buildAgentDefinitions } from './agents'
import { readDevServerEnv } from './env'
import { createMockAdapter } from './mock/mock-adapter'
import { openApiSpec } from './openapi'
import { createConversationsRoutes } from './routes/conversations'
import { createProvidersRoutes } from './routes/providers'

/**
 * 组装 dev 演示服务：@toimc/server/mastra 网关 + mock 剧本 + mastra agents（env 门控）。
 * 线协议与前端 sse-adapter 完全一致（导出供测试用 app.request() 直接调用，不监听端口）。
 * async：MASTRA_MODEL 存在时要等 createMastraModel（内部动态加载 @mastra/core）完成注册。
 */
export async function createDevApp(env = readDevServerEnv()) {
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

  const providers = createProvidersRoutes(registry)

  const { app } = await createMastraGateway({
    models: registry,
    agents: env.mastra ? buildAgentDefinitions(env.mastra) : [],
    ...(env.token ? { auth: { tokens: [env.token] } } : {}),
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
  app.route('/providers', providers.app)
  app.get('/openapi.json', (c) => c.json(openApiSpec))

  return app
}

export type DevApp = Awaited<ReturnType<typeof createDevApp>>
