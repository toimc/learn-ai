import type { StreamChunk } from '@ai-chat/core'

/** 传输层消息 DTO：Date 序列化为 ISO 字符串 */
export interface ToolCallDTO {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  status: 'calling' | 'completed' | 'error'
  duration?: number
}

export interface ThinkingDTO {
  content: string
  duration?: number
}

export interface ChatMessageDTO {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: ThinkingDTO
  toolCalls?: ToolCallDTO[]
  createdAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  /** 一句话描述会话主题，侧边栏/列表展示用 */
  description: string
  updatedAt: string
  messageCount: number
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessageDTO[]
}

export interface CreateConversationBody {
  title?: string
}

export interface ChatRequestBody {
  conversationId?: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  model?: string
  /** 速度倍率：1 正常，<1 加速（测试用 0），>1 更慢 */
  speed?: number
}

/** SSE 帧里的 data 载荷与 @ai-chat/core 的 StreamChunk 保持同构 */
export type SseChunkPayload = StreamChunk

export interface ChatResponseBody {
  conversationId: string
  messageId: string
}
