import type {
  ChatAdapter,
  Message,
  SendMessageOptions,
  StreamChunk,
} from '@toimc/core'

export interface SseAdapterOptions {
  baseUrl?: string
  /** 每次发送时取当前会话 id（闭包注入，随切换更新） */
  getConversationId?: () => string | undefined
  /** 每次发送时取会话绑定的模型 id（优先于 opts.model，闭包注入） */
  getModel?: () => string | undefined
}

const DEFAULT_BASE_URL = 'http://localhost:8787'

/** 非 2xx 时拼上服务端 {error} 详情（如 unknown model: custom-1），无详情则只报状态码 */
export async function httpErrorMessage(res: Response): Promise<string> {
  const detail = await res
    .json()
    .then((b) => (b && typeof b.error === 'string' ? b.error : ''))
    .catch(() => '')
  return detail
    ? `dev-server HTTP ${res.status}: ${detail}`
    : `dev-server HTTP ${res.status}`
}

/** 与 @toimc/dev-server 的线格式对应（Date 序列化为 ISO 字符串） */
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
  if (!res.ok) throw new Error(await httpErrorMessage(res))
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
  if (!res.ok) throw new Error(await httpErrorMessage(res))
  return (await res.json()) as ConversationSummary
}

/** 探活：接口文档页顶部状态条用 */
export async function checkHealth(
  baseUrl = DEFAULT_BASE_URL,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`)
    return res.ok
  } catch {
    return false
  }
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
            model: options.getModel?.() ?? opts.model,
          }),
          signal,
        })
      } catch (err) {
        // 中断不算错误，直接结束流
        if (signal?.aborted || isAbortError(err)) return
        throw new Error(`dev-server unreachable (${baseUrl})`, { cause: err })
      }

      if (!response.ok) {
        throw new Error(await httpErrorMessage(response))
      }
      if (!response.body) {
        throw new Error('dev-server response has no body')
      }

      yield* parseSseStream(response.body, signal)
    },
  }
}

/**
 * 解析 SSE 字节流为帧载荷序列（T 默认 StreamChunk）。
 * 帧 separator 为空行（\n\n），容忍 \r\n；只认 data: 行，其余（event:/id:/注释）忽略。
 */
export async function* parseSseStream<
  T extends { type?: string } = StreamChunk,
>(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<T> {
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
        const chunk = parseFrame<T>(frame)
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

function parseFrame<T>(frame: string): T | null {
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
