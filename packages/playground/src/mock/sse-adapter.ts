import type {
  ChatAdapter,
  Message,
  SendMessageOptions,
  StreamChunk,
} from '@ai-chat/core'

export interface SseAdapterOptions {
  baseUrl?: string
  /** 每次发送时取当前会话 id（闭包注入，随切换更新） */
  getConversationId?: () => string | undefined
}

const DEFAULT_BASE_URL = 'http://localhost:8787'

/** 与 @ai-chat/mock-server 的线格式对应（Date 序列化为 ISO 字符串） */
export interface ConversationSummary {
  id: string
  title: string
  description: string
  updatedAt: string
  messageCount: number
}

export interface ConversationMessageDTO {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: { content: string; duration?: number }
  toolCalls?: Message['toolCalls']
  createdAt: string
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`mock-server HTTP ${res.status}`)
  return (await res.json()) as T
}

export function fetchConversations(baseUrl = DEFAULT_BASE_URL) {
  return getJson<{ conversations: ConversationSummary[] }>(
    `${baseUrl}/api/conversations`,
  )
}

export function fetchConversationMessages(
  id: string,
  baseUrl = DEFAULT_BASE_URL,
) {
  return getJson<{ id: string; messages: ConversationMessageDTO[] }>(
    `${baseUrl}/api/conversations/${id}/messages`,
  )
}

export async function createConversation(
  baseUrl = DEFAULT_BASE_URL,
): Promise<ConversationSummary> {
  const res = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`mock-server HTTP ${res.status}`)
  return (await res.json()) as ConversationSummary
}

/**
 * 真实网络版 ChatAdapter：POST /api/chat 消费 SSE 流。
 * 与 mock-adapter（本地 AsyncGenerator）相对，走完整 HTTP 层，
 * DevTools Network 面板可见 text/event-stream 响应。
 */
export function createSseAdapter(options: SseAdapterOptions = {}): ChatAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL

  return {
    async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
      const signal = opts.signal
      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            conversationId: options.getConversationId?.(),
            messages: opts.messages.map((m: Message) => ({
              role: m.role,
              content: m.content,
            })),
            model: opts.model,
          }),
          signal,
        })
      } catch (err) {
        // 中断不算错误，直接结束流
        if (signal?.aborted || isAbortError(err)) return
        throw new Error(`mock-server unreachable (${baseUrl})`, { cause: err })
      }

      if (!response.ok) {
        throw new Error(`mock-server HTTP ${response.status}`)
      }
      if (!response.body) {
        throw new Error('mock-server response has no body')
      }

      yield* parseSseStream(response.body, signal)
    },
  }
}

/**
 * 解析 SSE 字节流为 StreamChunk 序列。
 * 帧 separator 为空行（\n\n），容忍 \r\n；只认 data: 行，其余（event:/id:/注释）忽略。
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) return
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const chunk = parseFrame(frame)
        if (chunk) yield chunk
        if (chunk?.type === 'done') return
      }
    }
  } catch (err) {
    // reader.read 在中断时抛 AbortError，属正常结束
    if (!isAbortError(err)) throw err
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): StreamChunk | null {
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(
        line.slice(5).startsWith(' ') ? line.slice(6) : line.slice(5),
      )
    }
  }
  if (dataLines.length === 0) return null
  try {
    return JSON.parse(dataLines.join('\n')) as StreamChunk
  } catch {
    // 半截 JSON 或非载荷帧：跳过，等下一帧
    return null
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
