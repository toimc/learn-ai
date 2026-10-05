import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { generateId } from '@toimc/core'
import type { StreamChunk } from '@toimc/core'
import type { ChatRequest, ModelRegistry, RegisteredModel } from '@toimc/agents'
import type {
  AssistantResultMessage,
  ChatCompletionResult,
  ChatRequestBody,
  ChatUsage,
  GatewayEnv,
} from '../types'
import type { IdentityStore } from '../identity/types'

export interface ChatRoutesDeps {
  registry: ModelRegistry
  /** body.model 缺省时使用的模型 id；未指定时取注册表第一个 */
  defaultModel?: string
  /** 流收尾钩子（含客户端中止与适配器异常场景） */
  onComplete?: (result: ChatCompletionResult) => void | Promise<void>
  /** identity 模式的存储端口：thread 归属校验（identifyUser 已在上游写入 userId） */
  identity?: { store: IdentityStore }
}

/**
 * POST / 聊天路由（挂载在 basePath 下）：
 * 解析 ChatRequestBody → 选择模型 → 消费适配器 AsyncGenerator →
 * SSE 逐块输出 StreamChunk（event: chunk）→ 流收尾触发 onComplete。
 * messages/model 之外的请求体字段整体透传给适配器 passthrough；
 * 适配器异常以 error chunk 收尾（最后一帧），保持线协议可解析。
 */
export function createChatRoutes(deps: ChatRoutesDeps): Hono<GatewayEnv> {
  const app = new Hono<GatewayEnv>()

  app.post('/', async (c) => {
    const body = (await c.req
      .json()
      .catch(() => null)) as ChatRequestBody | null
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages is required' }, 400)
    }

    // identity 模式：归属只信认证身份——客户端传入的 userId 一律丢弃后覆写；
    // conversationId（= mastra thread）首次使用即登记归属，他人占用返回 403
    if (deps.identity) {
      const userId = c.get('userId')
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)
      delete body.userId
      const thread = body.conversationId
      if (typeof thread === 'string' && thread) {
        const owned = await deps.identity.store.claimThread(thread, userId)
        if (!owned) {
          return c.json(
            { error: 'Forbidden thread', code: 'THREAD_FORBIDDEN' },
            403,
          )
        }
      }
      body.userId = userId
    }

    let modelId: string
    try {
      modelId = resolveModelId(body.model, deps)
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        400,
      )
    }

    let registered: RegisteredModel
    try {
      registered = deps.registry.get(modelId)
    } catch {
      return c.json(
        { error: `unknown model: ${String(body.model ?? modelId)}` },
        400,
      )
    }

    // messages/model 之外的字段（speed、conversationId 等）整体透传
    const passthrough: Record<string, unknown> = { ...body }
    delete passthrough.messages
    delete passthrough.model
    const request: ChatRequest = {
      messages: body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      signal: c.req.raw.signal,
      passthrough,
    }

    return streamSSE(c, async (stream) => {
      const collector = createAssistantCollector(generateId())
      const startedAt = Date.now()
      let aborted = false

      try {
        for await (const chunk of registered.adapter.chatStream(request)) {
          if (stream.aborted) {
            aborted = true
            break
          }
          collector.push(chunk)
          await stream.writeSSE({ event: 'chunk', data: JSON.stringify(chunk) })
          if (chunk.type === 'done') break
        }
        if (!aborted && collector.lastType !== 'done') {
          // 适配器未发 done 即结束：兜底补帧，保持线协议收尾
          const done: StreamChunk = { type: 'done', content: '' }
          collector.push(done)
          await stream.writeSSE({ event: 'chunk', data: JSON.stringify(done) })
        }
      } catch (err) {
        const errorChunk: StreamChunk = {
          type: 'error',
          content: err instanceof Error ? err.message : String(err),
        }
        collector.push(errorChunk)
        await stream.writeSSE({
          event: 'chunk',
          data: JSON.stringify(errorChunk),
        })
      }

      await deps.onComplete?.({
        body,
        model: modelId,
        assistant: collector.toResult(),
        usage: collector.usage,
        durationMs: Date.now() - startedAt,
        aborted,
      })
    })
  })

  return app
}

function resolveModelId(model: unknown, deps: ChatRoutesDeps): string {
  if (typeof model === 'string' && model) return model
  if (deps.defaultModel) return deps.defaultModel
  const first = deps.registry.list()[0]
  if (!first) throw new Error('no models registered')
  return first.id
}

/** 在流式过程中按 chunk 类型累积出一条可持久化的助手消息 */
function createAssistantCollector(id: string) {
  let content = ''
  let thinking = ''
  let lastType = ''
  let usage: ChatUsage | undefined
  const toolCalls: NonNullable<AssistantResultMessage['toolCalls']> = []
  const toolIndex = new Map<string, number>()

  return {
    get lastType() {
      return lastType
    },
    /** 适配器在 done 帧 metadata.usage 回传的真实 token 用量（缺席为 undefined） */
    get usage() {
      return usage
    },
    push(chunk: StreamChunk) {
      lastType = chunk.type
      if (chunk.type === 'text') {
        content += chunk.content
        return
      }
      if (chunk.type === 'thinking') {
        thinking += chunk.content
        return
      }
      if (chunk.type === 'done') {
        const meta = (chunk.metadata ?? {}) as Record<string, unknown>
        const raw = meta.usage as
          { inputTokens?: unknown; outputTokens?: unknown } | undefined
        if (
          raw &&
          (typeof raw.inputTokens === 'number' ||
            typeof raw.outputTokens === 'number')
        ) {
          usage = {
            inputTokens:
              typeof raw.inputTokens === 'number' ? raw.inputTokens : 0,
            outputTokens:
              typeof raw.outputTokens === 'number' ? raw.outputTokens : 0,
          }
        }
        return
      }
      const meta = (chunk.metadata ?? {}) as Record<string, unknown>
      if (chunk.type === 'tool_call') {
        const toolCallId = String(meta.toolCallId ?? '')
        // 同 toolCallId 可能来多帧（流式起点帧 + 完整参数帧）：命中则原位更新，
        // 避免重复 entry 停在 calling 状态
        const existingIndex = toolIndex.get(toolCallId)
        if (existingIndex !== undefined) {
          const existing = toolCalls[existingIndex]
          if (meta.toolArguments) {
            existing.arguments = meta.toolArguments as Record<string, unknown>
          }
          if (meta.toolName) existing.name = String(meta.toolName)
          return
        }
        toolIndex.set(toolCallId, toolCalls.length)
        toolCalls.push({
          id: toolCallId,
          name: String(meta.toolName ?? 'unknown'),
          arguments: (meta.toolArguments as Record<string, unknown>) ?? {},
          status: 'calling',
        })
        return
      }
      if (chunk.type === 'tool_result') {
        const tc = toolCalls[toolIndex.get(String(meta.toolCallId)) ?? -1]
        if (tc) {
          tc.status = meta.toolError ? 'error' : 'completed'
          tc.result = meta.toolResult
          tc.duration = meta.duration as number | undefined
        }
      }
    },
    toResult(): AssistantResultMessage {
      return {
        id,
        role: 'assistant',
        content,
        thinking: thinking ? { content: thinking } : undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        createdAt: new Date().toISOString(),
      }
    },
  }
}
