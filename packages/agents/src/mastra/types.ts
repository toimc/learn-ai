import type { MastraAdapter } from './index'

/** createMastraModel 配置：服务商/模型相关的一切都在这里（易变层） */
export interface MastraModelConfig {
  /** 对外模型 id（registry 注册名 / 前端 model 参数） */
  id: string
  name?: string
  description?: string
  /** Mastra model 字段：'provider/model' 字符串 | { id, url, apiKey? } 对象 | AI SDK 实例 */
  model: string | Record<string, unknown>
  instructions?: string
  /** createTool 产物字典，如 { getWeatherTool } */
  tools?: Record<string, unknown>
  /** Memory 实例（@mastra/memory）；不传则无记忆 */
  memory?: unknown
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}

export interface MastraAdapterOptions {
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}

export interface MastraModel {
  adapter: MastraAdapter
  info: {
    name: string
    description: string
    provider?: string
  }
  /** 底层 Agent 实例（供组装层挂 Mastra DevTools 用） */
  agent?: unknown
}
