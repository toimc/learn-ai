import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Message, StreamChunk } from '@toimc/core'
import { createDispatchAdapter } from '../../src/mock/dispatch-adapter'

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
