import type {
  ChatAdapter,
  Message,
  SendMessageOptions,
  StreamChunk,
} from '@toimc/core'
import { parseSseStream } from '../mock/sse-adapter'

export interface MastraAdapterOptions {
  /** mastra-app 基地址，默认 http://localhost:4111 */
  baseUrl?: string
  /** 每次发送时取当前会话 id（映射为 Mastra memory thread，闭包注入随切换更新） */
  getConversationId?: () => string | undefined
  /** 预留请求头注入点（未来 Bearer token 等），本期 UI 不接入 */
  getHeaders?: () => Record<string, string>
}

const DEFAULT_BASE_URL = 'http://localhost:4111'
const AGENT_ID = 'chat-agent'
const MEMORY_RESOURCE = 'ai-chat-playground'

/**
 * Mastra 1.60 原生流 chunk 的最小消费面（@mastra/core AgentChunkType 的结构子集）：
 * `{ type, payload }` + runId/from/metadata 信封字段（信封不参与映射，容忍缺失）。
 * playground 不依赖 @toimc/agents 也不安装 @mastra/core，类型按 dist 类型手工建模。
 */
interface MastraChunk {
  type: string
  payload?: {
    text?: string
    toolCallId?: string
    toolName?: string
    argsTextDelta?: string
    args?: unknown
    result?: unknown
    isError?: boolean
    error?: unknown
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error ?? fallback)
}

function toArguments(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/**
 * 前端转协议的 Mastra ChatAdapter：POST mastra-app 原生端点
 * `/api/agents/chat-agent/stream`，把 Mastra 原生事件流映射为 StreamChunk。
 * 与 `packages/agents/src/mastra/index.ts` 的服务端映射器同构（三 Map 语义一致）。
 *
 * 与 8787 网关链路的关键差异：原生端点不保证发 done 帧，流自然结束时自补。
 */
export function createMastraAdapter(
  options: MastraAdapterOptions = {},
): ChatAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL

  return {
    async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
      const signal = opts.signal
      const thread = options.getConversationId?.()
      const body = {
        messages: opts.messages.map((m: Message) => ({
          role: m.role,
          content: m.content,
        })),
        ...(thread ? { memory: { thread, resource: MEMORY_RESOURCE } } : {}),
        ...(opts.temperature !== undefined
          ? { modelSettings: { temperature: opts.temperature } }
          : {}),
      }

      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/agents/${AGENT_ID}/stream`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(options.getHeaders?.() ?? {}),
          },
          body: JSON.stringify(body),
          signal,
        })
      } catch (err) {
        // 中断不算错误，直接结束流（对齐 sse-adapter）
        if (signal?.aborted || isAbortError(err)) return
        throw new Error(`mastra-app unreachable (${baseUrl})`, { cause: err })
      }

      if (!response.ok) {
        throw new Error(`mastra-app HTTP ${response.status}`)
      }
      if (!response.body) {
        throw new Error('mastra-app response has no body')
      }

      /** tool-call-delta 累积的参数 JSON 片段（按 toolCallId） */
      const pendingArgs = new Map<string, string>()
      /** 已发出完整参数的 toolCallId（tool-call 完整事件去重） */
      const completedArgs = new Set<string>()
      /** streaming-end payload 不带 toolName，从 start 事件记录回填 */
      const toolNames = new Map<string, string>()

      for await (const frame of parseSseStream<MastraChunk>(
        response.body,
        signal,
      )) {
        const payload = frame.payload ?? {}
        switch (frame.type) {
          case 'text-delta': {
            if (payload.text) yield { type: 'text', content: payload.text }
            break
          }
          case 'reasoning-delta': {
            if (payload.text) yield { type: 'thinking', content: payload.text }
            break
          }
          case 'tool-call-input-streaming-start': {
            const { toolCallId, toolName } = payload
            if (!toolCallId) break
            toolNames.set(toolCallId, toolName ?? '')
            yield {
              type: 'tool_call',
              content: '',
              metadata: { toolCallId, toolName },
            }
            break
          }
          case 'tool-call-delta': {
            const key = payload.toolCallId
            if (!key) break
            pendingArgs.set(
              key,
              (pendingArgs.get(key) ?? '') + (payload.argsTextDelta ?? ''),
            )
            break
          }
          case 'tool-call-input-streaming-end': {
            const key = payload.toolCallId
            if (!key) break
            const raw = pendingArgs.get(key) ?? ''
            pendingArgs.delete(key)
            completedArgs.add(key)
            let args: Record<string, unknown> | undefined
            if (raw) {
              try {
                // 合法 JSON 但非对象（"42"/true 等标量）不是工具入参，与解析失败同退 { raw }
                args = toArguments(JSON.parse(raw)) ?? { raw }
              } catch {
                args = { raw }
              }
            }
            yield {
              type: 'tool_call',
              content: '',
              metadata: {
                toolCallId: key,
                toolName: toolNames.get(key),
                toolArguments: args,
              },
            }
            break
          }
          case 'tool-call': {
            const { toolCallId, toolName, args } = payload
            if (!toolCallId || completedArgs.has(toolCallId)) break
            completedArgs.add(toolCallId)
            if (toolName) toolNames.set(toolCallId, toolName)
            yield {
              type: 'tool_call',
              content: '',
              metadata: {
                toolCallId,
                toolName,
                toolArguments: toArguments(args),
              },
            }
            break
          }
          case 'tool-result': {
            const { toolCallId, toolName, result, isError } = payload
            yield {
              type: 'tool_result',
              content: '',
              metadata: isError
                ? {
                    toolCallId,
                    toolName,
                    toolError: toErrorMessage(result, 'tool error'),
                  }
                : { toolCallId, toolName, toolResult: result },
            }
            break
          }
          case 'tool-error': {
            const { toolCallId, toolName, error } = payload
            yield {
              type: 'tool_result',
              content: '',
              metadata: {
                toolCallId,
                toolName,
                toolError: toErrorMessage(error, 'tool error'),
              },
            }
            break
          }
          case 'error': {
            yield {
              type: 'error',
              content: toErrorMessage(payload.error, 'stream error'),
            }
            return
          }
          case 'finish': {
            yield { type: 'done', content: '' }
            return
          }
          default:
            // start / step-* / raw / source 等信封与无关事件：丢弃（对齐服务端映射器）
            break
        }
      }

      // 中断导致流提前结束时不再补帧（abort 静默语义）
      if (signal?.aborted) return
      // 原生端点不保证发 done：自然结束自补收尾帧
      yield { type: 'done', content: '' }
    },
  }
}
