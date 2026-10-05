import type { Context, MiddlewareHandler } from 'hono'
import type { cors } from 'hono/cors'
import type { ModelConfig, ModelRegistry } from '@toimc/agents'
import type { GatewayIdentityOptions } from './identity/types'

/** hono/cors 的选项形态（透传给 hono 内置 cors 中间件） */
export type GatewayCorsOptions = Parameters<typeof cors>[0]

export type { GatewayEnv, GatewayIdentityOptions } from './identity/types'

/** 网关聊天请求体（线协议）：messages/model 之外的字段整体透传给适配器 */
export interface ChatRequestBody {
  /** 演示/持久化场景透传字段，网关自身只在 onComplete 原样回传 */
  conversationId?: string
  /**
   * 服务端认证注入（identity 模式）：客户端传入的同名字段会被覆写——
   * 归属只信认证身份，透传一律不信任。适配器可据此做 resource 隔离。
   */
  userId?: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  model?: string
  /** 其余字段（如 mock 的 speed）进 ChatRequest.passthrough */
  [key: string]: unknown
}

/** 一次对话的 token 用量（适配器在 done 帧 metadata.usage 里回传） */
export interface ChatUsage {
  inputTokens: number
  outputTokens: number
}

/** 流式过程按 chunk 类型累积出的助手消息（thinking 拼接、tool_call/result 配对） */
export interface AssistantResultMessage {
  id: string
  role: 'assistant'
  content: string
  thinking?: { content: string }
  toolCalls?: {
    id: string
    name: string
    arguments: Record<string, unknown>
    result?: unknown
    status: 'calling' | 'completed' | 'error'
    duration?: number
  }[]
  createdAt: string
}

/** onComplete 钩子的入参：一轮对话的完整摘要 */
export interface ChatCompletionResult {
  /** 原始请求体（conversationId 等透传字段在内；identity 模式含服务端注入的 userId） */
  body: ChatRequestBody
  /** 本轮使用的模型 id */
  model: string
  /** 累积出的助手消息 */
  assistant: AssistantResultMessage
  /** 适配器回传的真实 token 用量（done 帧 metadata.usage）；未回传时 undefined（宿主可估算兜底） */
  usage?: ChatUsage
  /** 从开始吐块到流结束的毫秒数 */
  durationMs: number
  /** 客户端主动中止时为 true（onComplete 仍会触发） */
  aborted: boolean
}

/** Bearer 认证选项：tokens 集合或自定义校验函数，二选一 */
export interface GatewayAuthOptions {
  tokens?: string[]
  verify?: (token: string) => boolean | Promise<boolean>
}

/** 内存滑动窗口限流选项 */
export interface GatewayRateLimitOptions {
  /** 窗口毫秒数，默认 60_000 */
  windowMs?: number
  /** 窗口内最大请求数，默认 30 */
  max?: number
  /** 限流 key 提取，默认取客户端 IP（x-forwarded-for 首段或 connInfo） */
  keyBy?: (c: Context) => string
}

/** 聊天行为配置 */
export interface GatewayChatOptions {
  /** 流收尾钩子（含客户端中止场景），用于持久化/审计 */
  onComplete?: (result: ChatCompletionResult) => void | Promise<void>
}

/** createChatGateway 入参 */
export interface GatewayOptions {
  /** 注册中心；传数组时按内置 provider 自动构建 */
  models: ModelRegistry | ModelConfig[]
  /** 路由前缀，默认 '/api' */
  basePath?: string
  /** CORS 开关与选项，默认 true（hono 默认放行策略） */
  cors?: boolean | GatewayCorsOptions
  /** 请求日志（hono/logger），默认 false */
  logging?: boolean
  /** Bearer 认证，缺省关闭 */
  auth?: GatewayAuthOptions
  /**
   * 用户态认证与治理（19 章）：开启后取代 auth——API Key/JWT 识别用户、
   * 挂载 /auth 路由、/chat 上叠加每日配额与 thread 归属校验。
   * 缺省关闭（静态 Bearer 白名单模式维持现状）
   */
  identity?: GatewayIdentityOptions
  /** 限流，缺省关闭 */
  rateLimit?: GatewayRateLimitOptions
  /** body.model 缺省时使用的模型 id；缺省取注册表第一个 */
  defaultModel?: string
  chat?: GatewayChatOptions
}

/** 中间件签名（底层件导出用） */
export type GatewayMiddleware = MiddlewareHandler
