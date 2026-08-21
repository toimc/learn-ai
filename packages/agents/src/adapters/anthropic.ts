import type { StreamChunk } from '@toimc/core'
import { parseSseStream } from '../sse'
import type {
  ChatRequest,
  ChatResponse,
  IModelAdapter,
  ModelConfig,
} from '../types'

const DEFAULT_BASE_URL = 'https://api.anthropic.com'
const API_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 4096

interface AnthropicChatPayload {
  content?: { type: string; text?: string }[]
  model?: string
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface AnthropicStreamPayload {
  type: string
  delta?: { type: string; text?: string; thinking?: string }
  error?: { message?: string }
}

/**
 * Anthropic 原生协议适配器（/v1/messages）。
 *
 * - 端点：`${baseURL ?? 'https://api.anthropic.com'}/v1/messages`
 * - 鉴权：`x-api-key` + `anthropic-version: 2023-06-01`
 * - system 消息提取为顶层 system 参数，其余消息原样传递
 * - maxTokens 缺省 4096（Anthropic 必填）
 * - 流式映射：content_block_delta 的 text_delta → text、thinking_delta → thinking；
 *   message_stop → done；event: error → error chunk
 */
export class AnthropicAdapter implements IModelAdapter {
  constructor(readonly config: ModelConfig) {}

  private endpoint(): string {
    return `${this.config.baseURL ?? DEFAULT_BASE_URL}/v1/messages`
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    }
  }

  private buildBody(
    request: ChatRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: request.messages.filter((m) => m.role !== 'system'),
      stream,
    }
    if (system) body.system = system
    if (request.temperature !== undefined)
      body.temperature = request.temperature
    return body
  }

  private async request(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(this.endpoint(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Anthropic API ${response.status}: ${detail.slice(0, 200)}`,
      )
    }
    return response
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.request(
      this.buildBody(request, false),
      request.signal,
    )
    const data = (await response.json()) as AnthropicChatPayload
    return {
      content: (data.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join(''),
      model: data.model ?? this.config.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
          }
        : undefined,
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const response = await this.request(
      this.buildBody(request, true),
      request.signal,
    )
    if (!response.body) throw new Error('Anthropic API response has no body')

    for await (const frame of parseSseStream(response.body, request.signal)) {
      let payload: AnthropicStreamPayload
      try {
        payload = JSON.parse(frame.data) as AnthropicStreamPayload
      } catch {
        continue
      }
      if (payload.type === 'content_block_delta') {
        const delta = payload.delta
        if (delta?.type === 'text_delta' && delta.text) {
          yield { type: 'text', content: delta.text }
        } else if (delta?.type === 'thinking_delta' && delta.thinking) {
          yield { type: 'thinking', content: delta.thinking }
        }
      } else if (payload.type === 'message_stop') {
        yield { type: 'done', content: '' }
        return
      } else if (payload.type === 'error') {
        yield {
          type: 'error',
          content: payload.error?.message ?? 'Anthropic API error',
        }
        return
      }
    }
    // 兜底收尾
    yield { type: 'done', content: '' }
  }
}
