import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { AnthropicAdapter } from '@toimc/agents'
import type { ModelConfig } from '@toimc/agents'

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const config: ModelConfig = {
  id: 'claude',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  apiKey: 'sk-ant-test',
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

describe('AnthropicAdapter.chat', () => {
  it('POST /v1/messages，x-api-key + anthropic-version 鉴权，system 提取为顶层字段', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        content: [
          { type: 'text', text: '你' },
          { type: 'text', text: '好' },
        ],
        usage: { input_tokens: 3, output_tokens: 5 },
        model: 'claude-sonnet-4-5',
      }),
    )
    const adapter = new AnthropicAdapter(config)

    const response = await adapter.chat({
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: '你好' },
      ],
    })

    expect(response).toEqual({
      content: '你好',
      model: 'claude-sonnet-4-5',
      usage: { promptTokens: 3, completionTokens: 5 },
    })

    const { url, init } = callOf(fetchMock)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init?.method).toBe('POST')
    expect(headerOf(init, 'x-api-key')).toBe('sk-ant-test')
    expect(headerOf(init, 'anthropic-version')).toBe('2023-06-01')
    expect(headerOf(init, 'content-type')).toBe('application/json')
    expect(bodyOf(init)).toEqual({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: '你好' }],
      system: '你是助手',
      stream: false,
    })
  })

  it('无 system 消息时 body 不出现 system 字段，temperature 未定义时不出现', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-sonnet-4-5',
      }),
    )
    const adapter = new AnthropicAdapter(config)
    await adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })
    const body = bodyOf(callOf(fetchMock).init)
    expect('system' in body).toBe(false)
    expect('temperature' in body).toBe(false)
  })

  it('maxTokens 覆盖缺省 4096，temperature 定义时进入 body', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-sonnet-4-5',
      }),
    )
    const adapter = new AnthropicAdapter(config)
    await adapter.chat({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 128,
    })
    const body = bodyOf(callOf(fetchMock).init)
    expect(body.max_tokens).toBe(128)
    expect(body.temperature).toBe(0.7)
  })

  it('自定义 baseURL 拼接端点', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-sonnet-4-5',
      }),
    )
    const adapter = new AnthropicAdapter({
      ...config,
      baseURL: 'https://proxy.example.com',
    })
    await adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })
    expect(callOf(fetchMock).url).toBe('https://proxy.example.com/v1/messages')
  })

  it('上游返回 401 时 reject 且错误消息包含状态码', async () => {
    stubFetch(() => new Response('unauthorized', { status: 401 }))
    const adapter = new AnthropicAdapter(config)
    await expect(
      adapter.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow('401')
  })
})

describe('AnthropicAdapter.chatStream', () => {
  const sseText = [
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"想"}}',
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
    '',
  ].join('\n')

  it('text_delta → text、thinking_delta → thinking、message_stop → done 收尾', async () => {
    stubFetch(() => sseResponse(sseText))
    const adapter = new AnthropicAdapter(config)
    const chunks = await collectChunks(
      adapter.chatStream({ messages: [{ role: 'user', content: 'hello' }] }),
    )
    expect(chunks).toEqual([
      { type: 'text', content: 'Hi' },
      { type: 'thinking', content: '想' },
      { type: 'done', content: '' },
    ])
  })

  it('请求 /v1/messages 且 body 携带 stream: true 与缺省 max_tokens', async () => {
    const fetchMock = stubFetch(() =>
      sseResponse('event: message_stop\ndata: {"type":"message_stop"}\n\n'),
    )
    const adapter = new AnthropicAdapter(config)
    await collectChunks(
      adapter.chatStream({ messages: [{ role: 'user', content: 'hello' }] }),
    )
    const { url, init } = callOf(fetchMock)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(headerOf(init, 'x-api-key')).toBe('sk-ant-test')
    expect(bodyOf(init)).toEqual({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    })
  })

  it('event: error 映射为 error chunk 后结束', async () => {
    stubFetch(() =>
      sseResponse(
        'event: error\ndata: {"type":"error","error":{"message":"overloaded"}}\n\n',
      ),
    )
    const adapter = new AnthropicAdapter(config)
    const chunks = await collectChunks(
      adapter.chatStream({ messages: [{ role: 'user', content: 'hello' }] }),
    )
    expect(chunks).toEqual([{ type: 'error', content: 'overloaded' }])
  })

  it('request.signal 原样传入 fetch 调用参数', async () => {
    const fetchMock = stubFetch(() =>
      sseResponse('event: message_stop\ndata: {"type":"message_stop"}\n\n'),
    )
    const adapter = new AnthropicAdapter(config)
    const controller = new AbortController()
    await collectChunks(
      adapter.chatStream({
        messages: [{ role: 'user', content: 'hello' }],
        signal: controller.signal,
      }),
    )
    expect(callOf(fetchMock).init?.signal).toBe(controller.signal)
  })

  it('上游非 2xx 时首个 next() reject 且错误消息包含状态码', async () => {
    stubFetch(() => new Response('overloaded', { status: 529 }))
    const adapter = new AnthropicAdapter(config)
    const generator = adapter.chatStream({
      messages: [{ role: 'user', content: 'hello' }],
    })
    await expect(generator.next()).rejects.toThrow('529')
  })
})
