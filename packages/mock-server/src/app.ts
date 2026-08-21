import { createChatGateway } from '@toimc/server'
import { ModelRegistry } from '@toimc/agents'
import type { Agent } from '@mastra/core/agent'
import { createMockAdapter } from './mock-adapter'
import { createConversationsRoutes } from './routes/conversations'
import { openApiSpec } from './openapi'
import { readMastraEnv, registerMastraAgent } from './mastra/register'
import { attachMastraInstance } from './mastra/index'

/**
 * 组装 mock 演示服务：@toimc/server 网关 + mock 剧本适配器 + 会话演示路由。
 * 线协议与前端 sse-adapter 完全一致（导出供测试用 app.request() 直接调用，不监听端口）。
 * async：MASTRA_MODEL 存在时要等 createMastraModel（内部动态加载 @mastra/core）完成注册。
 */
export async function createMockApp() {
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

  // MASTRA_MODEL 存在时注册 Mastra Agent；缺省则行为与纯 mock 完全一致
  const mastraEnv = readMastraEnv(process.env)
  let mastraAgent: Awaited<ReturnType<typeof registerMastraAgent>> | undefined
  if (mastraEnv) {
    mastraAgent = await registerMastraAgent(registry, mastraEnv)
  }

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

  // telemetry=true 时装配 Mastra 实例（npx mastra dev 起 Studio 的入口）
  if (mastraAgent?.agent && process.env.MASTRA_TELEMETRY === 'true') {
    // 上游 MastraModel.agent 类型声明为 unknown，实现固定为 new Agent(...)，收窄有依据
    attachMastraInstance({ 'mastra-agent': mastraAgent.agent as Agent })
  }

  return app
}

export type MockApp = Awaited<ReturnType<typeof createMockApp>>
