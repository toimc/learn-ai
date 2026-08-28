import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { chatAgentDefinition, CHAT_AGENT_ID } from '../agents/chat-agent'
import { readDevServerEnv } from '../env'

/**
 * Studio / mastra build / mastra start 的入口：必须是静态命名导出
 * `export const mastra`（mastra CLI 静态分析模块级导出，工厂或 let 赋值拿不到——
 * spec 12 §3.1 约束继续生效）。
 * 模块加载即用 env 构建 agent：缺 MASTRA_MODEL 抛可读错误（Studio 本就需要真实模型）。
 * 服务入口 src/index.ts 不 import 本文件（纯 mock 模式零 mastra 依赖，spec 14 §5.2）。
 */
const env = readDevServerEnv()
if (!env.mastra) {
  throw new Error(
    '缺少环境变量 MASTRA_MODEL：Studio 需要真实模型，请在 packages/dev-server/.env 配置（参照 .env.example）',
  )
}

const def = chatAgentDefinition(env.mastra)
const chatAgent = new Agent({
  id: def.id,
  name: def.name ?? def.id,
  instructions: def.instructions ?? '',
  // 定义层宽松 Record 在此收窄（对齐 mastra-app 先例：env 组装只产 string / { id, url } 两种形态）
  model: def.model as ConstructorParameters<typeof Agent>[0]['model'],
  tools: def.tools as ConstructorParameters<typeof Agent>[0]['tools'],
  memory: def.memory
    ? (def.memory() as ConstructorParameters<typeof Agent>[0]['memory'])
    : undefined,
})

export const mastra = new Mastra({
  agents: { [CHAT_AGENT_ID]: chatAgent },
  ...(env.telemetry ? { telemetry: { enabled: true } } : {}),
})
