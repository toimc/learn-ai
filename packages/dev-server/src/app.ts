import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { createMastraGateway } from '@toimc/server/mastra'
import { estimateTokens } from '@toimc/core'
import { ModelRegistry } from '@toimc/agents'
import type { MastraAgentDefinition } from '@toimc/server/mastra'
import type { ChatCompletionResult } from '@toimc/server'
import type { IdentityStore } from '@toimc/server'
import { buildAgentDefinitions } from './agents'
import { readDevServerEnv } from './env'
import { createIdentityStore } from './identity/store'
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
/** 根路径落地页：纯 API 服务在浏览器里的自描述（端点清单 + 当前配置状态） */
function landingPage(env: ReturnType<typeof readDevServerEnv>): string {
  const retrieval = env.embedding
    ? `语义 + 关键词混合检索（${env.embedding.model}）`
    : '关键词检索（未配置 EMBEDDING_MODEL）'
  const llm = env.mastra ? env.mastra.model : 'mock 模式（未配置 MASTRA_MODEL）'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ai-chat-ui dev-server</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#1f2937}
  h1{font-size:24px}h1 code{font-size:18px;color:#6366f1}
  .badge{display:inline-block;background:#dcfce7;color:#166534;padding:2px 10px;border-radius:12px;font-size:13px}
  table{border-collapse:collapse;width:100%;margin:16px 0}
  td,th{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:14px}
  code{background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:13px}
  pre{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px}
  .meta{color:#6b7280;font-size:14px}
</style>
</head>
<body>
<h1>ai-chat-ui <code>dev-server</code></h1>
<p><span class="badge">running</span></p>
<p class="meta">LLM：${llm}<br>检索：${retrieval}</p>
<table>
<tr><th>端点</th><th>说明</th></tr>
<tr><td><code>GET /api/health</code></td><td>健康检查</td></tr>
<tr><td><code>GET /api/models</code></td><td>模型 / agent 列表</td></tr>
<tr><td><code>POST /api/chat</code></td><td>对话（SSE 流式，body 含 model/messages）</td></tr>
<tr><td><code>GET /api/vector/stats</code></td><td>向量库状态（chunks / 维度）</td></tr>
<tr><td><code>POST /api/vector/search</code></td><td>语义检索演示（keyword 与 hybrid 双路对比）</td></tr>
<tr><td><code>GET /api/openapi.json</code></td><td>OpenAPI 规范</td></tr>
</table>
<pre>curl -X POST ${'<本服务地址>'}/api/chat \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"docs-agent","messages":[{"role":"user","content":"聊天气泡怎么用"}]}'</pre>
</body>
</html>`
}

export async function createDevApp(
  env = readDevServerEnv(),
  options: {
    providersPersist?: boolean
    /** identity 存储注入（测试接临时库）；缺省按 env.auth.dbUrl 自建 */
    identityStore?: IdentityStore
    /** 配额时钟注入（测试跨日重置用） */
    now?: () => Date
  } = {},
) {
  // 用户体系门控（19-01）：AUTH_MODE=user 启用；密钥缺省启动即报错优于静默裸奔。
  // 旧调用方可能传不带 auth 的 partial env（缺省按 static 兼容）
  const auth = env.auth
  const identity =
    auth?.mode === 'user'
      ? (options.identityStore ?? (await createIdentityStore(auth.dbUrl)))
      : null
  if (identity && !auth.jwtSecret) {
    throw new Error(
      'AUTH_MODE=user 需要 AUTH_JWT_SECRET 环境变量（JWT 签发密钥不能缺省）',
    )
  }

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

  // 用户态 resource 归属覆写（19-01 IDOR 防线）：memory.resource 一律由
  // 服务端注入的 userId 决定（user:{userId}），未认证回退演示缺省 'ai-chat'
  const userResource = (passthrough: Record<string, unknown>): string =>
    typeof passthrough.userId === 'string' && passthrough.userId
      ? `user:${passthrough.userId}`
      : 'ai-chat'
  const agentDefs: MastraAgentDefinition[] = env.mastra
    ? buildAgentDefinitions(env.mastra, await loadContext7Tools(env))
    : []
  const agents = identity
    ? agentDefs.map((def) => ({ ...def, resource: userResource }))
    : agentDefs

  const { app } = await createMastraGateway({
    models: registry,
    agents,
    // 静态白名单只在 static 模式生效；用户态由 identity 接管认证
    ...(!identity && env.token ? { auth: { tokens: [env.token] } } : {}),
    ...(identity
      ? {
          identity: {
            store: identity,
            jwtSecret: auth.jwtSecret,
            freeDailyQuota: auth.freeDailyQuota,
            proDailyQuota: auth.proDailyQuota,
            ...(options.now ? { now: options.now } : {}),
          },
        }
      : {}),
    chat: {
      // 流结束后把这一轮对话写回服务端会话历史（切走再切回仍在）
      onComplete(result) {
        if (identity) recordUsage(identity, result)
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

  // 网关 app 带 basePath('/api')，根路径落地页包在外的 root 上挂
  const root = new Hono()
  root.get('/', (c) => c.html(landingPage(env)))
  root.route('/', app)

  return root
}

export type DevApp = Awaited<ReturnType<typeof createDevApp>>

/**
 * 用量记账（19-02 onComplete 钩子）：provider 真实 usage 优先（适配器 done 帧
 * 回传，mock/mastra 均带）；缺席时按 core 的 estimateTokens 估算兜底并标记
 * estimated。usage_log 是后续计费/成本报表的唯一数据源。
 */
function recordUsage(store: IdentityStore, result: ChatCompletionResult): void {
  const userId = result.body.userId
  if (!userId) return
  const usage = result.usage
  void store.insertUsage({
    userId,
    model: result.model,
    inputTokens: usage
      ? usage.inputTokens
      : estimateTokens(JSON.stringify(result.body.messages)),
    outputTokens: usage
      ? usage.outputTokens
      : estimateTokens(result.assistant.content),
    estimated: !usage,
    createdAt: new Date().toISOString(),
  })
}
