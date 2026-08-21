import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { createMastraModel } from '@toimc/agents/mastra'
import type { ModelRegistry } from '@toimc/agents'
import { getTimeTool, getWeatherTool } from './tools'

/** 会话记忆落盘位置（相对 mock-server 包目录；.temp/ 已在 .gitignore） */
const MEMORY_DB_URL = 'file:.temp/mastra.db'

/** libsql 本地文件模式不自动建父目录，目录缺失时 SQLITE_CANTOPEN 直接崩启动 */
function ensureDbDir(url: string): void {
  if (!url.startsWith('file:')) return
  const path = url.slice('file:'.length)
  if (!path || path === ':memory:') return
  mkdirSync(dirname(path), { recursive: true })
}

/** 默认记忆存储：本地 LibSQL 文件库，进程重启对话保留 */
function defaultMemory(): Memory {
  ensureDbDir(MEMORY_DB_URL)
  return new Memory({
    storage: new LibSQLStore({ id: 'mastra-memory', url: MEMORY_DB_URL }),
  })
}

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
  const memory = overrides.memory ?? defaultMemory()
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
