export interface Attachment {
  type: 'image' | 'file' | 'audio'
  url: string
  name: string
  mimeType: string
  size?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: Record<string, unknown>
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
