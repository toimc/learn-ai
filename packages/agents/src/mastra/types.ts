import type { MastraAdapter } from './index'

/** createMastraModel 配置：服务商/模型相关的一切都在这里（易变层） */
export interface MastraModelConfig {
  /** 对外模型 id（registry 注册名 / 前端 model 参数） */
  id: string
  name?: string
  description?: string
  /**
   * Mastra model 字段，三种形态：
   * - 'provider/model' 字符串（走 Mastra 模型路由）
   * - { id, url, apiKey? } 对象（OpenAICompatibleConfig 形态，自建/网关端点）
   * - AI SDK LanguageModel 实例（宿主自行构造的 provider 实例）
   */
  model: string | Record<string, unknown> | object
  instructions?: string
  /** createTool 产物字典，如 { getWeatherTool } */
  tools?: Record<string, unknown>
  /** Memory 实例（@mastra/memory）；不传则无记忆 */
  memory?: unknown
  /**
   * memory.resource，默认 'ai-chat'；函数形态按请求 passthrough 计算
   * （多用户治理：宿主传 `(p) => p.userId ? \`user:\${p.userId}\` : 'ai-chat'`
   * 实现服务端归属覆写，见 @toimc/server identity 模式）
   */
  resource?: string | ((passthrough: Record<string, unknown>) => string)
}

export interface MastraAdapterOptions {
  /** memory.resource，默认 'ai-chat'；函数形态见 MastraModelConfig.resource */
  resource?: string | ((passthrough: Record<string, unknown>) => string)
  /** chat() 返回的 model 标识；缺省 'mastra-agent'（工厂默认传配置 id） */
  modelId?: string
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
