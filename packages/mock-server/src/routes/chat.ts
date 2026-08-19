import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { nextId } from '../data/conversations'
import { buildReply } from '../scenarios'
import type { ChatRequestBody, ChatMessageDTO } from '../types'
import type { ConversationsService } from './conversations'

/**
 * POST /api/chat：消费消息历史，以 SSE 逐块返回 StreamChunk。
 *
 * 线格式（与 @ai-chat/core 的 StreamChunk 同构）：
 *   event: chunk
 *   data: {"type":"text","content":"..."}
 */
export function createChatRoutes(conversations: ConversationsService) {
  const app = new Hono()

  app.post('/', async (c) => {
    const body = (await c.req
      .json<ChatRequestBody>()
      .catch(() => null)) as ChatRequestBody | null
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
    // 边界防御：非字符串内容按空输入处理，走默认剧本
    const input = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const script = buildReply(input)
    const speed = Math.max(0, body.speed ?? 1)

    const messageId = nextId('m')
    const conversation = conversations.ensureConversation(body.conversationId)

    return streamSSE(
      c,
      async (stream) => {
        const assistant = collectAssistant(messageId)
        for (const { chunk, delayMs } of script) {
          if (stream.aborted) break
          await stream.sleep(Math.round(delayMs * speed))
          await stream.writeSSE({ event: 'chunk', data: JSON.stringify(chunk) })
          assistant.push(chunk)
        }
        // 流结束后把这一轮对话写回服务端会话历史（切走再切回仍在）
        if (conversation && lastUser) {
          conversations.appendExchange(
            conversation.id,
            lastUser.content,
            assistant.toDTO(),
          )
        }
      },
      async (err, stream) => {
        // 剧本执行出错：以 error chunk 收尾，保持线协议可解析
        await stream.writeSSE({
          event: 'chunk',
          data: JSON.stringify({ type: 'error', content: String(err) }),
        })
      },
    )
  })

  return app
}

/** 在流式过程中按 chunk 类型累积出一条可持久化的助手消息 */
function collectAssistant(id: string) {
  let content = ''
  let thinking = ''
  const toolCalls: NonNullable<ChatMessageDTO['toolCalls']> = []
  const startedAt = Date.now()
  const toolIndex = new Map<string, number>()

  return {
    push(chunk: {
      type: string
      content: string
      metadata?: Record<string, unknown>
    }) {
      if (chunk.type === 'text') content += chunk.content
      if (chunk.type === 'thinking') thinking += chunk.content
      if (chunk.type === 'tool_call') {
        toolIndex.set(String(chunk.metadata?.toolCallId), toolCalls.length)
        toolCalls.push({
          id: String(chunk.metadata?.toolCallId ?? ''),
          name: String(chunk.metadata?.toolName ?? 'unknown'),
          arguments:
            (chunk.metadata?.toolArguments as Record<string, unknown>) ?? {},
          status: 'calling',
        })
      }
      if (chunk.type === 'tool_result') {
        const idx = toolIndex.get(String(chunk.metadata?.toolCallId))
        const tc = idx === undefined ? undefined : toolCalls[idx]
        if (tc) {
          tc.status = chunk.metadata?.toolError ? 'error' : 'completed'
          tc.result = chunk.metadata?.toolResult
          tc.duration = chunk.metadata?.duration as number | undefined
        }
      }
    },
    toDTO(): ChatMessageDTO {
      return {
        id,
        role: 'assistant',
        content,
        thinking: thinking
          ? { content: thinking, duration: Date.now() - startedAt }
          : undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        createdAt: new Date().toISOString(),
      }
    },
  }
}
