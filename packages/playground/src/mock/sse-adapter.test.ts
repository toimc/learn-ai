import { describe, expect, it, vi, afterEach } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { createSseAdapter, parseSseStream } from './sse-adapter'

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < frames.length) {
        controller.enqueue(encoder.encode(frames[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

describe('parseSseStream', () => {
  it('逐帧解析 chunk 事件为 StreamChunk', async () => {
    const body = sseBody([
      'event: chunk\ndata: {"type":"text","content":"你好"}\n\n',
      'event: chunk\ndata: {"type":"text","content":"！"}\n\n',
      'event: chunk\ndata: {"type":"done","content":""}\n\n',
    ])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks.map((c) => c.type)).toEqual(['text', 'text', 'done'])
    expect(chunks[0].content).toBe('你好')
  })

  it('一个 TCP 分片里有多帧也能全部解出（分帧缓冲）', async () => {
    const body = sseBody([
      'data: {"type":"thinking","content":"a"}\n\ndata: {"type":"text","content":"b"}\n\n',
    ])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks.map((c) => c.type)).toEqual(['thinking', 'text'])
  })

  it('一帧被拆到两个分片时正确拼接', async () => {
    const body = sseBody(['data: {"type":"text","cont', 'ent":"ok"}\n\n'])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks).toEqual([{ type: 'text', content: 'ok' }])
  })

  it('容忍 \\r\\n 分行', async () => {
    const body = sseBody(['data: {"type":"done","content":""}\r\n\r\n'])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks).toEqual([{ type: 'done', content: '' }])
  })

  it('done 后忽略后续数据', async () => {
    const body = sseBody([
      'data: {"type":"done","content":""}\n\n',
      'data: {"type":"text","content":"late"}\n\n',
    ])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks).toEqual([{ type: 'done', content: '' }])
  })

  it('坏 JSON 帧跳过不抛错', async () => {
    const body = sseBody([
      'data: {broken\n\n',
      'data: {"type":"done","content":""}\n\n',
    ])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks.map((c) => c.type)).toEqual(['done'])
  })

  it('注释行与 event 行被忽略', async () => {
    const body = sseBody([
      ': keep-alive\nevent: chunk\ndata: {"type":"done","content":""}\n\n',
    ])
    const chunks: StreamChunk[] = []
    for await (const chunk of parseSseStream(body)) chunks.push(chunk)
    expect(chunks).toEqual([{ type: 'done', content: '' }])
  })
})

describe('createSseAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  function okSseResponse(frames: string[]): Response {
    return new Response(sseBody(frames), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
  }

  it('sendMessage 走 POST /api/chat 并携带会话 id 与消息历史', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse([
          'data: {"type":"text","content":"hi"}\n\n',
          'data: {"type":"done","content":""}\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const convId = 'conv_vue'
    const adapter = createSseAdapter({ getConversationId: () => convId })
    const chunks: StreamChunk[] = []
    for await (const chunk of adapter.sendMessage({
      messages: [
        { id: 'a', role: 'user', content: '你好', createdAt: new Date() },
        { id: 'b', role: 'assistant', content: '', createdAt: new Date() },
      ],
    })) {
      chunks.push(chunk)
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8787/api/chat')
    expect(init.method).toBe('POST')
    const payload = JSON.parse(init.body)
    expect(payload.conversationId).toBe('conv_vue')
    expect(payload.messages).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '' },
    ])
    expect(chunks.map((c) => c.type)).toEqual(['text', 'done'])
  })

  it('服务端不可达时抛出可读错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const adapter = createSseAdapter()
    await expect(
      adapter
        .sendMessage({
          messages: [
            { id: 'a', role: 'user', content: 'x', createdAt: new Date() },
          ],
        })
        .next(),
    ).rejects.toThrow('mock-server unreachable')
  })

  it('HTTP 非 2xx 抛出状态码错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 500 })),
    )
    const adapter = createSseAdapter()
    await expect(
      adapter
        .sendMessage({
          messages: [
            { id: 'a', role: 'user', content: 'x', createdAt: new Date() },
          ],
        })
        .next(),
    ).rejects.toThrow('HTTP 500')
  })
})
