import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ChatAdapter, Message, StreamChunk } from '@toimc/core'
import { createMastraAdapter } from './mastra-adapter'

afterEach(() => vi.unstubAllGlobals())

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

function okSseResponse(frames: string[]): Response {
  return new Response(sseBody(frames), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

/** 每次调用返回全新 Response（body 只能读一次），mock 供调用参数断言 */
function stubSse(frames: string[]) {
  const fetchMock = vi.fn(async () => okSseResponse(frames))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function collect(
  gen: AsyncGenerator<StreamChunk>,
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of gen) chunks.push(chunk)
  return chunks
}

function userMessage(content = '你好'): Message {
  return { id: 'm1', role: 'user', content, createdAt: new Date() }
}

async function sendMessages(
  adapter: ChatAdapter,
  messages: Message[] = [userMessage()],
): Promise<StreamChunk[]> {
  return collect(adapter.sendMessage({ messages }))
}

const FINISH_FRAME =
  'data: {"type":"finish","payload":{"stepResult":{"reason":"stop"}},"runId":"run_1"}\n\n'

describe('createMastraAdapter', () => {
  it('sendMessage 走 POST /api/agents/chat-agent/stream，合并 content-type 与 getHeaders，signal 直通 fetch', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    const adapter = createMastraAdapter({
      getHeaders: () => ({ authorization: 'Bearer mastra-token' }),
    })
    const signal = new AbortController().signal
    await collect(adapter.sendMessage({ messages: [userMessage()], signal }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:4111/api/agents/chat-agent/stream')
    expect(init.method).toBe('POST')
    expect(init.signal).toBe(signal)
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('authorization')).toBe('Bearer mastra-token')
  })

  it('body 投影 messages 为 role/content，携带 memory 与 modelSettings，不发送 model 字段', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    const adapter = createMastraAdapter({ getConversationId: () => 'conv_1' })
    await collect(
      adapter.sendMessage({
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: '北京天气如何',
            createdAt: new Date(),
          },
          {
            id: 'm2',
            role: 'assistant',
            content: '我来查查',
            createdAt: new Date(),
          },
        ],
        model: 'should-not-send',
        temperature: 0.3,
      }),
    )

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.messages).toEqual([
      { role: 'user', content: '北京天气如何' },
      { role: 'assistant', content: '我来查查' },
    ])
    expect(payload.memory).toEqual({
      thread: 'conv_1',
      resource: 'ai-chat-playground',
    })
    expect(payload.modelSettings).toEqual({ temperature: 0.3 })
    expect(payload.model).toBeUndefined()
  })

  it('自定义 baseUrl 替换请求地址', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    const adapter = createMastraAdapter({ baseUrl: 'http://mastra.local:9000' })
    await sendMessages(adapter)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://mastra.local:9000/api/agents/chat-agent/stream',
    )
  })

  it('getEndpoint 可配：请求指向 custom-agent 运行时端点（baseUrl 不变）', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    const adapter = createMastraAdapter({
      getEndpoint: () => '/api/app/agents/custom-agent/stream',
    })
    await sendMessages(adapter)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:4111/api/app/agents/custom-agent/stream',
    )
  })

  it('未传 getConversationId 与 temperature 时 body 不含 memory 与 modelSettings 字段', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    await sendMessages(createMastraAdapter())
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.memory).toBeUndefined()
    expect(payload.modelSettings).toBeUndefined()
  })

  it('getConversationId 返回空字符串时 body 同样不含 memory', async () => {
    const fetchMock = stubSse([FINISH_FRAME])
    const adapter = createMastraAdapter({ getConversationId: () => '' })
    await sendMessages(adapter)
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.memory).toBeUndefined()
  })

  it('HTTP 非 2xx 抛出含状态码的错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 500 })),
    )
    await expect(
      createMastraAdapter()
        .sendMessage({ messages: [userMessage()] })
        .next(),
    ).rejects.toThrow('HTTP 500')
  })

  it('网络不可达时抛出含基地址提示的错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    await expect(
      createMastraAdapter()
        .sendMessage({ messages: [userMessage()] })
        .next(),
    ).rejects.toThrow('http://localhost:4111')
  })

  it('fetch 以 AbortError 拒绝时静默结束：零 chunk、不抛错、不自补 done', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
    const chunks = await sendMessages(createMastraAdapter())
    expect(chunks).toEqual([])
  })

  it('发送前 signal 已中断时静默结束零 chunk', async () => {
    const controller = new AbortController()
    controller.abort()
    stubSse([
      'data: {"type":"text-delta","payload":{"id":"t1","text":"late"}}\n\n',
    ])
    const chunks = await collect(
      createMastraAdapter().sendMessage({
        messages: [userMessage()],
        signal: controller.signal,
      }),
    )
    expect(chunks).toEqual([])
  })

  it('响应无 body 时抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    )
    // 契约只规定"抛错"未规定 message，故此处仅断言 reject 发生
    await expect(
      createMastraAdapter()
        .sendMessage({ messages: [userMessage()] })
        .next(),
    ).rejects.toThrow()
  })
})

describe('Mastra 事件映射', () => {
  it('text-delta 与 reasoning-delta 按帧序映射为 text/thinking，空 text 不发帧', async () => {
    stubSse([
      'event: text-delta\ndata: {"type":"text-delta","payload":{"id":"t1","text":"你"},"runId":"run_1"}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t1","text":"好"}}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t1","text":""},"runId":"run_1"}\n\n',
      'data: {"type":"reasoning-delta","payload":{"id":"r1","text":"先查一下天气"},"runId":"run_1","from":"agent"}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t1","text":"！"}}\n\n',
      'data: {"type":"finish","payload":{"stepResult":{"reason":"stop","usage":{"steps":1}}},"runId":"run_1"}\n\n',
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      { type: 'text', content: '你' },
      { type: 'text', content: '好' },
      { type: 'thinking', content: '先查一下天气' },
      { type: 'text', content: '！' },
      { type: 'done', content: '' },
    ])
  })

  it('流式工具调用全链路：壳帧 → delta 不发帧 → end 完整帧（toolName 回填、参数解析）→ tool-result', async () => {
    stubSse([
      'data: {"type":"start","runId":"run_1"}\n\n',
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_1","toolName":"getWeather"},"runId":"run_1"}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_1","argsTextDelta":"{\\"ci"},"runId":"run_1"}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_1","argsTextDelta":"ty\\":\\"Beijing\\"}","toolName":"getWeather"},"runId":"run_1"}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_1"}}\n\n',
      'data: {"type":"tool-result","payload":{"toolCallId":"call_1","toolName":"getWeather","result":{"temperature":26,"condition":"晴"},"isError":false},"runId":"run_1"}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t1","text":"今天北京 26 度"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_1', toolName: 'getWeather' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'getWeather',
          toolArguments: { city: 'Beijing' },
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'getWeather',
          toolResult: { temperature: 26, condition: '晴' },
        },
      },
      { type: 'text', content: '今天北京 26 度' },
      { type: 'done', content: '' },
    ])
  })

  it('tool-call 完整事件未走流式时直接映射完整参数帧；args 非对象时 toolArguments 为 undefined', async () => {
    stubSse([
      'data: {"type":"tool-call","payload":{"toolCallId":"call_f","toolName":"search","args":{"query":"vue 3"}},"runId":"run_1"}\n\n',
      'data: {"type":"tool-call","payload":{"toolCallId":"call_s","toolName":"echo","args":"just-a-string"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_f',
          toolName: 'search',
          toolArguments: { query: 'vue 3' },
        },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_s', toolName: 'echo' },
      },
      { type: 'done', content: '' },
    ])
  })

  it('同 toolCallId 流式三连后再来 tool-call 完整事件被去重，只发一壳一全', async () => {
    stubSse([
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_1","toolName":"search"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_1","argsTextDelta":"{\\"q\\":\\"vue\\"}"}}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_1"}}\n\n',
      'data: {"type":"tool-call","payload":{"toolCallId":"call_1","toolName":"search","args":{"q":"vue"}}}\n\n',
      'data: {"type":"tool-result","payload":{"toolCallId":"call_1","toolName":"search","result":"3 条结果"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_1', toolName: 'search' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'search',
          toolArguments: { q: 'vue' },
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'search',
          toolResult: '3 条结果',
        },
      },
      { type: 'done', content: '' },
    ])
  })

  it('多个工具调用的 delta 片段按 toolCallId 隔离累积', async () => {
    stubSse([
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_1","toolName":"getWeather"}}\n\n',
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_2","toolName":"search"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_1","argsTextDelta":"{\\"ci"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_2","argsTextDelta":"{\\"q\\":\\"vu"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_1","argsTextDelta":"ty\\":\\"Beijing\\"}"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_2","argsTextDelta":"e 3\\"}"}}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_1"}}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_2"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_1', toolName: 'getWeather' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_2', toolName: 'search' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'getWeather',
          toolArguments: { city: 'Beijing' },
        },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_2',
          toolName: 'search',
          toolArguments: { q: 'vue 3' },
        },
      },
      { type: 'done', content: '' },
    ])
  })

  it('delta 累积出非法 JSON 时 toolArguments 回退为 { raw: 累积字符串 }', async () => {
    stubSse([
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_b","toolName":"brokenTool"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_b","argsTextDelta":"{\\"ci"}}\n\n',
      'data: {"type":"tool-call-delta","payload":{"toolCallId":"call_b","argsTextDelta":"ty\\": oops}"}}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_b"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_b', toolName: 'brokenTool' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_b',
          toolName: 'brokenTool',
          toolArguments: { raw: '{"city": oops}' },
        },
      },
      { type: 'done', content: '' },
    ])
  })

  it('工具调用无 delta 片段时 end 帧 toolArguments 为 undefined', async () => {
    stubSse([
      'data: {"type":"tool-call-input-streaming-start","payload":{"toolCallId":"call_n","toolName":"noop"}}\n\n',
      'data: {"type":"tool-call-input-streaming-end","payload":{"toolCallId":"call_n"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_n', toolName: 'noop' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_n', toolName: 'noop' },
      },
      { type: 'done', content: '' },
    ])
  })

  it('tool-error 事件映射为 tool_result 帧携带 toolError', async () => {
    stubSse([
      'data: {"type":"tool-error","payload":{"toolCallId":"call_e","toolName":"db","error":"connection refused"},"runId":"run_1"}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_e',
          toolName: 'db',
          toolError: 'connection refused',
        },
      },
      { type: 'done', content: '' },
    ])
  })

  it('tool-result 标记 isError 时映射 toolError（result 为字符串取该字符串）', async () => {
    stubSse([
      'data: {"type":"tool-result","payload":{"toolCallId":"call_i","toolName":"getWeather","result":"city not found","isError":true}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_i',
          toolName: 'getWeather',
          toolError: 'city not found',
        },
      },
      { type: 'done', content: '' },
    ])
  })

  it('finish 事件映射 done 并立即终止，之后的帧被忽略', async () => {
    stubSse([
      'data: {"type":"text-delta","payload":{"id":"t1","text":"回答完成"},"runId":"run_1"}\n\n',
      FINISH_FRAME,
      'data: {"type":"text-delta","payload":{"id":"t2","text":"late"}}\n\n',
      'data: {"type":"error","payload":{"error":"late error"}}\n\n',
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      { type: 'text', content: '回答完成' },
      { type: 'done', content: '' },
    ])
  })

  it('SSE 流自然结束且无 finish 事件时自补一帧 done', async () => {
    stubSse([
      'data: {"type":"text-delta","payload":{"id":"t1","text":"部分回答"}}\n\n',
      'data: {"type":"step-finish","payload":{"stepResult":{"reason":"stop"},"stepName":"main"}}\n\n',
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      { type: 'text', content: '部分回答' },
      { type: 'done', content: '' },
    ])
  })

  it('error 事件映射 error 帧并立即终止，不发 done', async () => {
    stubSse([
      'data: {"type":"text-delta","payload":{"id":"t1","text":"部分"},"runId":"run_1"}\n\n',
      'data: {"type":"error","payload":{"error":"upstream model timeout"},"runId":"run_1"}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t2","text":"never"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      { type: 'text', content: '部分' },
      { type: 'error', content: 'upstream model timeout' },
    ])
  })

  it('start/step-*/raw/source/text-start/text-end 等无关事件被丢弃，输出序列不受影响', async () => {
    stubSse([
      'data: {"type":"start","payload":{},"runId":"run_1"}\n\n',
      'data: {"type":"step-start","payload":{"stepName":"main"},"runId":"run_1"}\n\n',
      'data: {"type":"text-start","payload":{"id":"t1"}}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t1","text":"ok"}}\n\n',
      'data: {"type":"text-end","payload":{"id":"t1"}}\n\n',
      'data: {"type":"source","payload":{"source":{"sourceType":"url","url":"https://example.com"}}}\n\n',
      'data: {"type":"raw","payload":{"raw":{"providerMetadata":"x"}}}\n\n',
      'data: {"type":"step-finish","payload":{"stepResult":{"reason":"stop"},"stepName":"main"}}\n\n',
      'data: {"type":"text-delta","payload":{"id":"t2","text":"!"}}\n\n',
      FINISH_FRAME,
    ])

    const chunks = await sendMessages(createMastraAdapter())

    expect(chunks).toEqual([
      { type: 'text', content: 'ok' },
      { type: 'text', content: '!' },
      { type: 'done', content: '' },
    ])
  })
})
