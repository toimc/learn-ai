import type { StreamChunk } from '@toimc/core'

/** 对话消息（传输与上游请求共用的最小形态，Date 不进线协议） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 模型接入配置：apiKey 只存在于服务端内存，
 * 禁止进入 /api/models 公开视图或任何日志。
 */
export interface ModelConfig {
  /** 对外模型 id：前端 model 参数与 /api/models 返回值 */
  id: string
  /** 协议适配器类型：'openai-compat' | 'anthropic'（自定义适配器经 registerAdapter 接入） */
  provider: string
  /** 上游真实模型名，如 'gpt-5-mini' / 'claude-sonnet-4-5' */
  model: string
  apiKey: string
  /** 上游 API 根地址，缺省用协议默认值 */
  baseURL?: string
  /** /api/models 展示名，缺省用 id */
  name?: string
  /** /api/models 展示描述 */
  description?: string
}

/** 非流式响应 */
export interface ChatResponse {
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number }
}

/** 工具参数描述（占位：本期无 ToolRegistry/Orchestrator，字段对齐课程第 15 章） */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
}

/** 工具定义（占位，本期适配器不消费） */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
}

/** 适配器请求：网关把解析后的用户请求整理为该形态 */
export interface ChatRequest {
  messages: ChatMessage[]
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  /** 占位字段，本期不消费 */
  tools?: ToolDefinition[]
  /**
   * 网关不解释的请求体字段，原样透传给适配器
   * （如 mock 的 speed、演示服务的 conversationId）
   */
  passthrough?: Record<string, unknown>
}

/** 模型适配器统一接口：一个实现适配一种上游协议 */
export interface IModelAdapter {
  chat(request: ChatRequest): Promise<ChatResponse>
  chatStream(request: ChatRequest): AsyncGenerator<StreamChunk>
}

/** ModelRegistry.list 与 /api/models 的公开视图：绝不含 apiKey/model 私有配置 */
export interface ModelPublicInfo {
  id: string
  name: string
  description: string
  provider?: string
}
