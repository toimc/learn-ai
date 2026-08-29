import { Mastra } from '@mastra/core'
import { buildAgentDefinitions } from '../agents'
import { readDevServerEnv } from '../env'
import { createStorage } from '../memory'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'
import { docsCouncilWorkflow } from '../workflows/docs-council'
import { docsPipelineWorkflow } from '../workflows/docs-pipeline'

/**
 * Studio / mastra build / mastra start 的入口：必须是静态命名导出
 * `export const mastra`（mastra CLI 静态分析模块级导出，工厂或 let 赋值拿不到——
 * spec 12 §3.1 约束继续生效）。
 * 模块加载即用 env 构建 agent：缺 MASTRA_MODEL 抛可读错误（Studio 本就需要真实模型）。
 * 服务入口 src/index.ts 不 import 本文件（纯 mock 模式零 mastra 依赖，spec 14 §5.2）。
 * agent 清单来自注册表 buildAgentDefinitions + teamDefinitions（spec 16 §2：
 * 子 agent 不进网关模型下拉，但进 Studio 便于单独调试提示词）。
 * workflows 为编排形态的原生版（spec 16 §10）：/workflows 页可运行并看逐步 trace。
 */
const env = readDevServerEnv()
if (!env.mastra) {
  throw new Error(
    '缺少环境变量 MASTRA_MODEL：Studio 需要真实模型，请在 packages/dev-server/.env 配置（参照 .env.example）',
  )
}

const agents = Object.fromEntries(
  [...buildAgentDefinitions(env.mastra), ...teamDefinitions(env.mastra)].map(
    (def) => [def.id, instantiateAgent(def)] as const,
  ),
)

export const mastra = new Mastra({
  agents,
  workflows: {
    [docsPipelineWorkflow(env.mastra).id]: docsPipelineWorkflow(env.mastra),
    [docsCouncilWorkflow(env.mastra).id]: docsCouncilWorkflow(env.mastra),
  },
  storage: createStorage(),
  ...(env.telemetry ? { telemetry: { enabled: true } } : {}),
})
