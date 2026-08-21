import type { StreamChunk } from '@toimc/core'
import { parseSseStream } from '../sse'
import type {
  ChatRequest,
  ChatResponse,
  IModelAdapter,
  ModelConfig,
} from '../types'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

interface OpenAIChatPayload {
  choices?: { message?: { content?: string } }[]
  model?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

interface OpenAIStreamPayload {
  choices?: {
    delta?: { content?: string; reasoning_content?: string }
    finish_reason?: string | null
  }[]
}

/**
 * OpenAI 兼容协议适配器（OpenAI / DeepSeek / GLM / Kimi / OpenRouter 等）。
 *
 * - 端点：`${baseURL ?? 'https://api.openai.com/v1'}/chat/completions`
 * - 鉴权：`Authorization: Bearer <apiKey>`
 * - 流式映射：choices[0].delta.content → text；delta.reasoning_content（DeepSeek
 *   系推理输出）→ thinking；`data: [DONE]` → done；上游非 2xx 抛错（消息含状态码）
 */
export class OpenAICompatibleAdapter implements IModelAdapter {
  constructor(readonly config: ModelConfig) {}

  private endpoint(): string {
    return `${this.config.baseURL ?? DEFAULT_BASE_URL}/chat/completions`
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.config.apiKey}`,
      'content-type': 'application/json',
    }
  }

  private buildBody(
    request: ChatRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages,
      stream,
    }
    if (request.temperature !== undefined)
      body.temperature = request.temperature
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens
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
        `OpenAI-compatible API ${response.status}: ${detail.slice(0, 200)}`,
      )
    }
    return response
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.request(
      this.buildBody(request, false),
      request.signal,
    )
    const data = (await response.json()) as OpenAIChatPayload
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? this.config.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const response = await this.request(
      this.buildBody(request, true),
      request.signal,
    )
    if (!response.body)
      throw new Error('OpenAI-compatible API response has no body')

    for await (const frame of parseSseStream(response.body, request.signal)) {
      if (frame.data === '[DONE]') {
        yield { type: 'done', content: '' }
        return
      }
      let payload: OpenAIStreamPayload
      try {
        payload = JSON.parse(frame.data) as OpenAIStreamPayload
      } catch {
        // 半截 JSON 或非载荷帧：跳过，等下一帧
        continue
      }
      const delta = payload.choices?.[0]?.delta
      if (delta?.reasoning_content) {
        yield { type: 'thinking', content: delta.reasoning_content }
      }
      if (delta?.content) {
        yield { type: 'text', content: delta.content }
      }
    }
    // 上游未发 [DONE] 即关流：兜底补 done，保持线协议收尾
    yield { type: 'done', content: '' }
  }
}
