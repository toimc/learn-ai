import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Message, StreamChunk } from '@toimc/core'
import { createDispatchAdapter } from './dispatch-adapter'

function userMessage(content: string): Message {
  return { id: `m_${content}`, role: 'user', content, createdAt: new Date() }
}

function okSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < frames.length) {
        controller.enqueue(encoder.encode(frames[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function collect(
  gen: AsyncGenerator<StreamChunk>,
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of gen) chunks.push(chunk)
  return chunks
}

describe('createDispatchAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('会话带 model 时委托 SSE：POST /api/chat 携带 model 与会话 id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse([
          'data: {"type":"thinking","content":"思考中"}\n\n',
          'data: {"type":"text","content":"回复"}\n\n',
          'data: {"type":"done","content":""}\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => ({ id: 'conv_9', model: 'custom-1' }),
    })
    const chunks = await collect(
      adapter.sendMessage({ messages: [userMessage('你好')] }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8787/api/chat')
    expect(init.method).toBe('POST')
    const payload = JSON.parse(init.body)
    expect(payload.model).toBe('custom-1')
    expect(payload.conversationId).toBe('conv_9')
    expect(chunks.map((c) => c.type)).toEqual(['thinking', 'text', 'done'])
  })

  it('会话不带 model 时委托本地 mock：不发生网络请求且产出 mock 流', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => ({ id: 'conv_1' }),
    })
    // 触发词「思考」让 mock 走确定性的思考流
    const chunks = await collect(
      adapter.sendMessage({ messages: [userMessage('思考')] }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(chunks[0].type).toBe('thinking')
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('无会话（getConversation 返回 undefined）时同样走本地 mock', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => undefined,
    })
    const chunks = await collect(
      adapter.sendMessage({ messages: [userMessage('思考')] }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(chunks[0].type).toBe('thinking')
  })

  it('会话 backend=mastra 时委托 Mastra 适配器：POST 4111 原生端点并映射为 StreamChunk', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse([
          'data: {"type":"text-delta","payload":{"id":"t1","text":"北京"},"runId":"run_1"}\n\n',
          'data: {"type":"finish","payload":{"stepResult":{"reason":"stop"}},"runId":"run_1"}\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => ({ id: 'conv_m', backend: 'mastra' }),
    })
    const chunks = await collect(
      adapter.sendMessage({ messages: [userMessage('北京天气')] }),
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:4111/api/agents/chat-agent/stream')
    expect(init.method).toBe('POST')
    const payload = JSON.parse(init.body)
    expect(payload.memory).toEqual({
      thread: 'conv_m',
      resource: 'ai-chat-playground',
    })
    // 原生 finish 事件被映射为 done 收尾
    expect(chunks).toEqual([
      { type: 'text', content: '北京' },
      { type: 'done', content: '' },
    ])
  })

  it('backend=mastra 优先于 model：即使会话同时带 model 也走 4111 而非 8787', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse([
          'data: {"type":"finish","payload":{"stepResult":{"reason":"stop"}}}\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => ({
        id: 'conv_x',
        model: 'custom-1',
        backend: 'mastra',
      }),
    })
    await collect(adapter.sendMessage({ messages: [userMessage('hi')] }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:4111/api/agents/chat-agent/stream',
    )
  })

  it('backend=mock-server 且无 model 时保持本地 mock 行为（快照只记录，分发仍按 model）', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createDispatchAdapter({
      getConversation: () => ({ id: 'conv_s', backend: 'mock-server' }),
    })
    const chunks = await collect(
      adapter.sendMessage({ messages: [userMessage('思考')] }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(chunks[0].type).toBe('thinking')
  })

  it('同一 adapter 实例随闭包切换分发路径（切会话语义）', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse(['data: {"type":"done","content":""}\n\n']),
      )
    vi.stubGlobal('fetch', fetchMock)

    let conv: { id: string; model?: string } | undefined = { id: 'c1' }
    const adapter = createDispatchAdapter({ getConversation: () => conv })

    // 第一轮：本地 mock
    await collect(adapter.sendMessage({ messages: [userMessage('思考')] }))
    expect(fetchMock).not.toHaveBeenCalled()

    // 第二轮：切到带 model 的会话
    conv = { id: 'c2', model: 'custom-2' }
    await collect(adapter.sendMessage({ messages: [userMessage('hi')] }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.model).toBe('custom-2')
    expect(payload.conversationId).toBe('c2')
  })
})
