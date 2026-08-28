import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { OpenAICompatibleAdapter } from '@toimc/agents'
import type { ChatRequest, ModelConfig } from '@toimc/agents'

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const config: ModelConfig = {
  id: 'gpt',
  provider: 'openai-compat',
  model: 'gpt-5-mini',
  apiKey: 'sk-test',
}

function stubFetch(respond: () => Response): Mock<FetchLike> {
  const fetchMock = vi.fn<FetchLike>(async () => respond())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name)
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

function callOf(fetchMock: Mock<FetchLike>): {
  url: string
  init?: RequestInit
} {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  return { url: urlOf(input), init }
}

async function collectChunks(
  gen: AsyncGenerator<StreamChunk>,
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of gen) chunks.push(chunk)
  return chunks
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenAICompatibleAdapter.chat', () => {
  it('POST 默认端点，Bearer 鉴权与 JSON body，非流式响应映射为 ChatResponse', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        choices: [{ message: { content: '答案' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
        model: 'gpt-5-mini',
      }),
    )
    const adapter = new OpenAICompatibleAdapter(config)

    const response = await adapter.chat({
      messages: [{ role: 'user', content: '你好' }],
    })

    expect(response).toEqual({
      content: '答案',
      model: 'gpt-5-mini',
      usage: { promptTokens: 11, completionTokens: 7 },
    })

    const { url, init } = callOf(fetchMock)
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(headerOf(init, 'authorization')).toBe('Bearer sk-test')
    expect(headerOf(init, 'content-type')).toBe('application/json')
    expect(bodyOf(init)).toEqual({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: '你好' }],
      stream: false,
    })
  })

  it('自定义 baseURL 拼接端点', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        choices: [{ message: { content: 'hi' } }],
        model: 'deepseek-chat',
      }),
    )
    const adapter = new OpenAICompatibleAdapter({
      ...config,
      baseURL: 'https://api.deepseek.com/v1',
    })
    await adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })
    expect(callOf(fetchMock).url).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    )
  })

  it('temperature/max_tokens 仅在请求定义时进入 body', async () => {
    const adapter = new OpenAICompatibleAdapter(config)

    const withOptions = stubFetch(() =>
      jsonResponse({
        choices: [{ message: { content: 'x' } }],
        model: 'gpt-5-mini',
      }),
    )
    await adapter.chat({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      maxTokens: 100,
    })
    expect(bodyOf(callOf(withOptions).init)).toEqual({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      temperature: 0.2,
      max_tokens: 100,
    })

    const withoutOptions = stubFetch(() =>
      jsonResponse({
        choices: [{ message: { content: 'x' } }],
        model: 'gpt-5-mini',
      }),
    )
    await adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })
    const body = bodyOf(callOf(withoutOptions).init)
    expect('temperature' in body).toBe(false)
    expect('max_tokens' in body).toBe(false)
  })

  it('上游返回 401 时 reject 且错误消息包含状态码', async () => {
    stubFetch(() => new Response('unauthorized', { status: 401 }))
    const adapter = new OpenAICompatibleAdapter(config)
    await expect(
      adapter.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('401')
  })
})

describe('OpenAICompatibleAdapter.chatStream', () => {
  const sseText = [
    'data: {"choices":[{"delta":{"reasoning_content":"思考中"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"你"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"好"}}]}',
    '',
    'data: [DONE]',
    '',
    '',
  ].join('\n')

  it('delta.content → text、reasoning_content → thinking、[DONE] → done 收尾', async () => {
    stubFetch(() => sseResponse(sseText))
    const adapter = new OpenAICompatibleAdapter(config)
    const chunks = await collectChunks(
      adapter.chatStream({ messages: [{ role: 'user', content: '你好' }] }),
    )
    expect(chunks).toEqual([
      { type: 'thinking', content: '思考中' },
      { type: 'text', content: '你' },
      { type: 'text', content: '好' },
      { type: 'done', content: '' },
    ])
  })

  it('请求同一端点并携带 Bearer 鉴权', async () => {
    const fetchMock = stubFetch(() => sseResponse('data: [DONE]\n\n'))
    const adapter = new OpenAICompatibleAdapter(config)
    await collectChunks(
      adapter.chatStream({ messages: [{ role: 'user', content: 'hi' }] }),
    )
    const { url, init } = callOf(fetchMock)
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(headerOf(init, 'authorization')).toBe('Bearer sk-test')
  })

  it('request.signal 原样传入 fetch 调用参数', async () => {
    const fetchMock = stubFetch(() => sseResponse('data: [DONE]\n\n'))
    const adapter = new OpenAICompatibleAdapter(config)
    const controller = new AbortController()
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
    }
    await collectChunks(adapter.chatStream(request))
    expect(callOf(fetchMock).init?.signal).toBe(controller.signal)
  })

  it('上游非 2xx 时首个 next() reject 且错误消息包含状态码', async () => {
    stubFetch(() => new Response('rate limited', { status: 429 }))
    const adapter = new OpenAICompatibleAdapter(config)
    const generator = adapter.chatStream({
      messages: [{ role: 'user', content: 'hi' }],
    })
    await expect(generator.next()).rejects.toThrow('429')
  })
})
