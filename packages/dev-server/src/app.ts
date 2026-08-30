import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMastraGateway } from '@toimc/server/mastra'
import { ModelRegistry } from '@toimc/agents'
import { buildAgentDefinitions } from './agents'
import { readDevServerEnv } from './env'
import { loadContext7Tools } from './mcp/context7'
import { createMockAdapter } from './mock/mock-adapter'
import { openApiSpec } from './openapi'
import { createConversationsRoutes } from './routes/conversations'
import { createProvidersRoutes } from './routes/providers'
import { createWorkflowsRoutes } from './routes/workflows'
import { createVectorRoutes } from './routes/vector'

/**
 * 组装 dev 演示服务：@toimc/server/mastra 网关 + mock 剧本 + mastra agents（env 门控）。
 * 线协议与前端 sse-adapter 完全一致（导出供测试用 app.request() 直接调用，不监听端口）。
 * async：MASTRA_MODEL 存在时要等 createMastraModel（内部动态加载 @mastra/core）完成注册。
 */
export async function createDevApp(
  env = readDevServerEnv(),
  options: { providersPersist?: boolean } = {},
) {
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

  // 生产入口（index.ts）显式开启注册表落盘：重启恢复且 id 沿用（测试缺省隔离不落盘）。
  // .temp 已在 .gitignore（apiKey 随配置落本地文件，仅重启恢复用）
  let providersPersistPath: string | undefined
  if (options.providersPersist) {
    const dir = join(process.cwd(), '.temp')
    mkdirSync(dir, { recursive: true })
    providersPersistPath = join(dir, 'providers.json')
  }
  const providers = createProvidersRoutes(registry, {
    persistPath: providersPersistPath,
  })
  if (providersPersistPath) await providers.restore()

  const { app } = await createMastraGateway({
    models: registry,
    // context7 工具（env 门控 + 失败降级）只挂 docs-agent：外部库文档查询
    agents: env.mastra
      ? buildAgentDefinitions(env.mastra, await loadContext7Tools(env))
      : [],
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
  // workflow 列表/运行端点：纯 mock 模式（mastra null）下 GET 返回空列表
  app.route('/workflows', createWorkflowsRoutes(env))
  // 向量检索演示端点：stats + 双路对比（docs 站 vector-search-demo 页数据源）
  app.route('/vector', createVectorRoutes())
  app.get('/openapi.json', (c) => c.json(openApiSpec))

  return app
}

export type DevApp = Awaited<ReturnType<typeof createDevApp>>
