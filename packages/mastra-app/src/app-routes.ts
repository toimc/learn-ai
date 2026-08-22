import { stream } from 'hono/streaming'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import type { Hono } from 'hono'
import type { Agent } from '@mastra/core/agent'
import {
  clearRuntimeModel,
  getRuntimeAgent,
  getRuntimeConfig,
  setRuntimeModel,
} from './runtime-model'
import type { RuntimeModelPayload } from './runtime-model'

type App = Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>

/** 校验失败文案（语义与 mock-server providers 路由一致） */
function validate(payload: Partial<RuntimeModelPayload>): string | null {
  if (!payload.name?.trim()) return 'name is required'
  if (payload.provider !== 'openai-compat' && payload.provider !== 'anthropic')
    return 'provider must be openai-compat or anthropic'
  if (!payload.apiKey?.trim()) return 'apiKey is required'
  if (!payload.model?.trim()) return 'model is required'
  if (payload.provider === 'openai-compat' && !payload.baseURL?.trim())
    return 'baseURL is required for openai-compat'
  return null
}

/** HTTP 线输入 → Mastra 消息数组：逐项收窄 role/content，非法项整体拒绝 */
function toModelMessages(
  value: unknown,
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> | null {
  if (!Array.isArray(value)) return null
  const messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const { role, content } = item as Record<string, unknown>
    if (
      (role !== 'user' && role !== 'assistant' && role !== 'system') ||
      typeof content !== 'string'
    ) {
      return null
    }
    messages.push({ role, content })
  }
  return messages
}

interface StreamRequestBody {
  messages?: unknown
  memory?: { thread: string; resource: string }
  modelSettings?: Record<string, unknown>
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 运行时模型路由（/api/app/* 前缀，与 MastraServer 的 /api/agents/* 无竞争；
 * 认证与 cors 由 createApp 的 /api/* 中间件统一覆盖）：
 * - POST/GET/DELETE /api/app/model：单条运行时模型配置（表单即换模型免重启）
 * - POST /api/app/agents/custom-agent/stream：custom-agent 的 Mastra 原生 SSE
 *   （chunk 直出 fullStream 信封帧，前端 MastraAdapter 已兼容该线格式）
 */
export function registerAppRoutes(app: App): void {
  app.post('/api/app/model', async (c) => {
    const payload = (await c.req
      .json<Partial<RuntimeModelPayload>>()
      .catch(() => ({}))) as Partial<RuntimeModelPayload>
    const error = validate(payload)
    if (error) return c.json({ error }, 400)
    // validate 已确保必填字段齐全，收窄到完整表单类型
    await setRuntimeModel(payload as RuntimeModelPayload)
    return c.json({ ok: true })
  })

  app.get('/api/app/model', (c) => {
    return c.json({ config: getRuntimeConfig() ?? null })
  })

  app.delete('/api/app/model', (c) => {
    clearRuntimeModel()
    return c.json({ ok: true })
  })

  app.post('/api/app/agents/custom-agent/stream', async (c) => {
    const agent = getRuntimeAgent()
    if (!agent) {
      return c.json({ error: 'no runtime model configured' }, 404)
    }

    const body = (await c.req
      .json<StreamRequestBody>()
      .catch(() => ({}))) as StreamRequestBody
    const messages = toModelMessages(body.messages)
    if (!messages) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const signal = c.req.raw.signal
    c.header('content-type', 'text/event-stream')
    return stream(c, async (s) => {
      try {
        const result = await agent.stream(
          // 逐项收窄后的消息数组，类型与 MessageListInput 的 CoreMessage 形态对齐
          messages as Parameters<Agent['stream']>[0],
          {
            abortSignal: signal,
            ...(agent.hasOwnMemory() && body.memory
              ? { memory: body.memory }
              : {}),
            ...(body.modelSettings
              ? { modelSettings: body.modelSettings }
              : {}),
          },
        )
        for await (const chunk of result.fullStream) {
          if (signal.aborted) return
          await s.write(`data: ${JSON.stringify(chunk)}\n\n`)
          if (chunk.type === 'error') break
        }
      } catch (err) {
        // 中断不算错误：静默结束流（不产 error 帧也不补 [DONE]）
        if (!signal.aborted && !isAbortError(err)) {
          await s.write(
            `data: ${JSON.stringify({
              type: 'error',
              payload: { error: errorMessage(err) },
            })}\n\n`,
          )
        }
      }
      if (!signal.aborted) await s.write('data: [DONE]\n\n')
    })
  })
}
