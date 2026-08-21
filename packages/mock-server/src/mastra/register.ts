import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { createMastraModel } from '@toimc/agents/mastra'
import type { ModelRegistry } from '@toimc/agents'
import { getTimeTool, getWeatherTool } from './tools'

export interface MastraEnvConfig {
  /** Mastra model 字段，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选） */
  modelUrl?: string
  /** 展示名（可选） */
  modelName?: string
}

/** 从环境变量解析；MASTRA_MODEL 缺失返回 null（不注册，行为与现状一致） */
export function readMastraEnv(
  env: Record<string, string | undefined>,
): MastraEnvConfig | null {
  const model = env.MASTRA_MODEL
  if (!model) return null
  return {
    model,
    ...(env.MASTRA_MODEL_URL ? { modelUrl: env.MASTRA_MODEL_URL } : {}),
    ...(env.MASTRA_MODEL_NAME ? { modelName: env.MASTRA_MODEL_NAME } : {}),
  }
}

/** 组装并注册 mastra-agent 模型；返回创建的 model（供 Mastra 实例挂载） */
export function registerMastraAgent(
  registry: ModelRegistry,
  config: MastraEnvConfig,
  overrides: { memory?: unknown } = {},
): ReturnType<typeof createMastraModel> {
  const memory =
    overrides.memory ??
    new Memory({
      storage: new LibSQLStore({
        id: 'mastra-memory',
        url: 'file:.temp/mastra.db',
      }),
    })
  const created = createMastraModel({
    id: 'mastra-agent',
    name: config.modelName ?? 'Mastra Agent',
    description: `Mastra 驱动的 Agent（${config.model}），支持工具调用与会话记忆`,
    model: config.modelUrl
      ? { id: config.model, url: config.modelUrl }
      : config.model,
    instructions:
      '你是 ai-chat-ui 的演示 Agent。需要时间或天气信息时调用对应工具，回答保持简洁。',
    tools: { getTimeTool, getWeatherTool },
    memory,
  })
  registry.registerAdapter('mastra-agent', created.adapter, created.info)
  return created
}
