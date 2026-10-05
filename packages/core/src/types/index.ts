export interface Attachment {
  id: string
  url?: string
  name: string
  mediaType: string
  size?: number
}

/** 工具调用生命周期（对齐 AI SDK 7 态的超集；旧三值是其子集，语义不变） */
export type ToolCallStatus =
  | 'pending' // 排队/参数流式组装中（input-streaming）
  | 'calling' // 执行中（运行期）
  | 'awaiting-approval' // 等待人工审批（approval-requested）
  | 'completed' // 完成（output-available）
  | 'denied' // 用户拒绝（output-denied）
  | 'error' // 失败（output-error）

export interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  status: ToolCallStatus
  duration?: number
}

/** 多步骤思维链单步（ThinkingChain 组件消费；ThinkingBlock 仍负责单块 content） */
export interface ThinkingStep {
  id: string
  title: string
  status: 'pending' | 'active' | 'complete' | 'error'
  content?: string
  /** 单步耗时 ms */
  duration?: number
}

export interface ThinkingInfo {
  content: string
  duration?: number // 思考耗时（毫秒）
  startTime?: Date // 思考开始时间
  /** 思考是否仍在进行：流式期间由 useChat 维护，首个非 thinking 内容帧到达即置 false */
  active?: boolean
  /** 结构化多步骤思维链（RAG/Agent 场景服务端组装，可选渐进增强） */
  steps?: ThinkingStep[]
}

/** 引用来源（RAG 检索/网页引用；对齐 AI SDK SourceUrl/SourceDocument 的并集形态） */
export interface MessageSource {
  id: string
  type: 'url' | 'document'
  title?: string
  /** type==='url' 时由渲染组件校验 http(s) 白名单后渲染外链 */
  url?: string
  /** 原文引用片段（InlineCitation 卡片 quote 展示） */
  snippet?: string
  /** 附加：相关性分数/页码/作者/年份等 */
  metadata?: Record<string, unknown>
}

// A/B 回复对比：由服务端响应指定，宿主据此渲染 ComparisonMessage 而非普通消息
export interface ComparisonPayload {
  left: string
  right: string
  leftLabel?: string
  rightLabel?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  toolCalls?: ToolCallInfo[]
  thinking?: ThinkingInfo // 思考过程内容
  sources?: MessageSource[] // RAG/检索引用来源（Sources/InlineCitation 消费）
  comparison?: ComparisonPayload // A/B 回复对比载荷
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: {
    toolCallId?: string
    toolName?: string
    toolArguments?: Record<string, unknown>
    toolResult?: unknown
    toolError?: string
    duration?: number
    [key: string]: unknown
  }
}

/** done 帧回传的 token 用量（metadata.usage 约定） */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface SendMessageOptions {
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface HistoryOptions {
  limit?: number
  offset?: number
}

export interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
  abort?(requestId: string): void
  getHistory?(options: HistoryOptions): Promise<Message[]>
}

export interface ChatOptions {
  initialMessages?: Message[]
  onError?: (error: Error) => void
  onResponse?: (chunk: StreamChunk) => void
  maxHistory?: number
  /** 上下文窗口（token）；支持 getter 以便宿主配置随选中模型变化。空/0/负 = 不截断 */
  maxContextTokens?: number | (() => number)
  /** 可注入的 token 估算器，默认 estimateTokens */
  tokenEstimator?: (text: string) => number
}

export interface ChatState {
  messages: Message[]
  isStreaming: boolean
  error: Error | null
  truncatedCount: number
  send: (content: string, attachments?: Attachment[]) => Promise<void>
  /** 重新生成：删除目标 assistant 消息及其后所有消息后重发；缺省取最后一条 assistant */
  regenerate: (messageId?: string) => Promise<void>
  /** 编辑用户消息：覆盖内容、删除其后所有消息、以新内容重发 */
  editMessage: (messageId: string, content: string) => Promise<void>
  abort: () => void
  clear: () => void
}
