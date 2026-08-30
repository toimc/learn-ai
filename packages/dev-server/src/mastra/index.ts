import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { buildAgentDefinitions } from '../agents'
import { readDevServerEnv } from '../env'
import { createCompositeStorage } from '../memory'
import { createObservability } from '../observability'
import { loadContext7Tools } from '../mcp/context7'
import { WEATHER_MCP_SERVER_ID, weatherMcpServer } from '../mcp/weather-server'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'
import { createDocsVectorStore } from '../rag/vector-store'
import { buildWorkflowRegistry } from '../workflows/registry'

/**
 * Studio / mastra build / mastra start 的入口：必须是静态命名导出
 * `export const mastra`（mastra CLI 静态分析模块级导出，工厂或 let 赋值拿不到——
 * spec 12 §3.1 约束继续生效）。
 * 模块加载即用 env 构建 agent：缺 MASTRA_MODEL 抛可读错误（Studio 本就需要真实模型）。
 * 服务入口 src/index.ts 不 import 本文件（纯 mock 模式零 mastra 依赖，spec 14 §5.2）。
 * agent 清单来自注册表 buildAgentDefinitions + teamDefinitions（spec 16 §2：
 * 子 agent 不进网关模型下拉，但进 Studio 便于单独调试提示词）。
 * workflows 为编排形态的原生版（spec 16 §10）：/workflows 页可运行并看逐步 trace。
 * context7（env 门控 + 失败降级空工具集）用顶层 await 装配，只挂 docs-agent。
 * mcpServers 为宿主侧：get_weather 经 /mcp 端点暴露给外部 MCP 客户端。
 * observability（env 门控、默认开）：traces/logs 落 composite storage 的
 * observability 域（独立 DuckDB 文件 observability.duckdb——LibSQL 无
 * batchCreateLogs），PinoLogger 控制台 + 观测库双写。
 */
const env = readDevServerEnv()
if (!env.mastra) {
  throw new Error(
    '缺少环境变量 MASTRA_MODEL：Studio 需要真实模型，请在 packages/dev-server/.env 配置（参照 .env.example）',
  )
}

const context7Tools = await loadContext7Tools(env)

const agents = Object.fromEntries(
  [
    ...buildAgentDefinitions(env.mastra, context7Tools),
    ...teamDefinitions(env.mastra),
  ].map((def) => [def.id, instantiateAgent(def)] as const),
)

export const mastra = new Mastra({
  agents,
  // workflow 清单来自注册表（与 /api/workflows 路由同源，消除重复装配）
  workflows: Object.fromEntries(
    buildWorkflowRegistry(env.mastra).map((entry) => [
      entry.id,
      entry.create(),
    ]),
  ),
  storage: await createCompositeStorage(),
  // 文档向量库挂进实例（key 'docs'）：Studio vectors 视图可见、Mastra vectors API
  // 可查——search_docs 语义检索路的数据源不再是黑盒（pnpm index:docs 写入）
  vectors: { docs: createDocsVectorStore() },
  // PinoLogger 双写：控制台输出 + 经 observability 落库（日志自动关联 trace/span）
  logger: new PinoLogger({ name: 'dev-server', level: 'info' }),
  // 宿主侧 MCP：mastra dev（4111）自动暴露 /mcp 端点，Claude Code / Inspector 可连。
  // 注册 key 与 server id 保持一致（listMCPServers 与端点路径引用同一名字）
  mcpServers: { [WEATHER_MCP_SERVER_ID]: weatherMcpServer },
  ...(env.observability ? { observability: createObservability() } : {}),
})
