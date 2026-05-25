export interface Attachment {
  id: string
  url?: string
  name: string
  mediaType: string
  size?: number
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  status: 'calling' | 'completed' | 'error'
  duration?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  toolCalls?: ToolCallInfo[]
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
}

export interface ChatState {
  messages: Message[]
  isStreaming: boolean
  error: Error | null
  send: (content: string, attachments?: Attachment[]) => Promise<void>
  abort: () => void
  clear: () => void
}
