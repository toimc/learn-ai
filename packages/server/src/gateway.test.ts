import { describe, expect, it, vi } from 'vitest'
import type { Hono } from 'hono'
import type { ChatRequest, IModelAdapter } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'
import { ModelRegistry } from '@toimc/agents'
import { createChatGateway } from '@toimc/server'
import type { ChatCompletionResult } from '@toimc/server'

/** 手写 fake 适配器：按剧本 yield StreamChunk，并记录收到的 ChatRequest 供断言 */
function fakeAdapter(script: StreamChunk[]) {
  const received: ChatRequest[] = []
  const adapter: IModelAdapter = {
    async chat() {
      throw new Error('本测试只消费 chatStream')
    },
    async *chatStream(request: ChatRequest) {
      received.push(request)
      for (const chunk of script) yield chunk
    },
  }
  return { adapter, received }
}

/** 首个 next 即 reject 的适配器（模拟上游异常） */
function errorAdapter(message: string): IModelAdapter {
  return {
    async chat() {
      throw new Error('本测试只消费 chatStream')
    },
    // 故意无 yield：首个 next() 即 reject，验证网关的异常兜底路径
    // eslint-disable-next-line require-yield
    async *chatStream() {
      throw new Error(message)
    },
  }
}

/** m1/m2 两个可区分剧本的 fake 模型注册中心 */
function makeRegistry() {
  const m1 = fakeAdapter([
    { type: 'text', content: '来自m1' },
    { type: 'done', content: '' },
  ])
  const m2 = fakeAdapter([
    { type: 'text', content: '来自m2' },
    { type: 'done', content: '' },
  ])
  const registry = new ModelRegistry()
    .registerAdapter('m1', m1.adapter, {
      name: '模型一',
      description: '演示模型一',
      provider: 'mock',
    })
    .registerAdapter('m2', m2.adapter, {
      name: '模型二',
      description: '演示模型二',
      provider: 'mock',
    })
  return { registry, m1, m2 }
}

function postChat(
  app: Hono,
  body: unknown,
  options: { headers?: Record<string, string>; path?: string } = {},
) {
  return app.request(options.path ?? '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** SSE 文本按空行切帧，解出全部 data 载荷（与前端 sse-adapter 同构的简化解析） */
function parseChunks(body: string): StreamChunk[] {
  return body.split('\n\n').flatMap((frame) =>
    frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()) as StreamChunk),
  )
}

describe('createChatGateway 路由挂载', () => {
  it('默认 basePath /api：models 与 health 均可访问', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    expect((await app.request('/api/models')).status).toBe(200)
    expect((await app.request('/api/health')).status).toBe(200)
  })

  it("basePath '/v1' 时路由挂在 /v1 下，旧前缀失效 404", async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry, basePath: '/v1' })

    expect((await app.request('/v1/models')).status).toBe(200)
    expect((await app.request('/v1/health')).status).toBe(200)
    const chat = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      { path: '/v1/chat' },
    )
    expect(chat.status).toBe(200)
    expect((await app.request('/api/health')).status).toBe(404)
  })
})

describe('GET /api/health', () => {
  it('返回 200 与 {status:"ok"}', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/models', () => {
  it('返回注册表公开视图字面量（脱敏，无 apiKey/model/baseURL）', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await app.request('/api/models')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      models: [
        {
          id: 'm1',
          name: '模型一',
          description: '演示模型一',
          provider: 'mock',
        },
        {
          id: 'm2',
          name: '模型二',
          description: '演示模型二',
          provider: 'mock',
        },
      ],
    })
  })
})

describe('POST /api/chat SSE 线协议', () => {
  it('按适配器剧本逐块转发 StreamChunk，done 收尾', async () => {
    const script: StreamChunk[] = [
      { type: 'text', content: '你' },
      { type: 'thinking', content: '想想' },
      { type: 'text', content: '好' },
      { type: 'done', content: '' },
    ]
    const fake = fakeAdapter(script)
    const registry = new ModelRegistry().registerAdapter('m1', fake.adapter, {
      name: '模型一',
      description: '演示模型一',
      provider: 'mock',
    })
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const body = await res.text()
    expect(body).toContain('event: chunk')
    const chunks = parseChunks(body)
    expect(chunks).toEqual(script)
    expect(chunks[chunks.length - 1].type).toBe('done')
  })
})

describe('请求透传与模型选择', () => {
  it('messages/model 之外的请求体字段整体透传给适配器', async () => {
    const { registry, m1 } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
      model: 'm1',
      speed: 2,
      conversationId: 'c9',
    })
    await res.text()

    expect(m1.received.length).toBe(1)
    expect(m1.received[0].messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(m1.received[0].passthrough).toEqual({
      speed: 2,
      conversationId: 'c9',
    })
  })

  it('body.model 指定时使用对应模型的适配器', async () => {
    const { registry, m1, m2 } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
      model: 'm2',
    })
    const chunks = parseChunks(await res.text())

    expect(chunks).toEqual([
      { type: 'text', content: '来自m2' },
      { type: 'done', content: '' },
    ])
    expect(m2.received.length).toBe(1)
    expect(m1.received.length).toBe(0)
  })

  it('未知 model 返回 400，错误消息包含该 id 且不触碰任何适配器', async () => {
    const { registry, m1, m2 } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
      model: 'nope',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
    expect(String(body.error)).toContain('nope')
    expect(m1.received.length).toBe(0)
    expect(m2.received.length).toBe(0)
  })

  it('缺省 body.model 时使用 defaultModel 指定的模型', async () => {
    const { registry, m1, m2 } = makeRegistry()
    const app = createChatGateway({ models: registry, defaultModel: 'm2' })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    const chunks = parseChunks(await res.text())

    expect(chunks[0]).toEqual({ type: 'text', content: '来自m2' })
    expect(m2.received.length).toBe(1)
    expect(m1.received.length).toBe(0)
  })

  it('未配置 defaultModel 时使用第一个注册的模型', async () => {
    const { registry, m1, m2 } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    const chunks = parseChunks(await res.text())

    expect(chunks[0]).toEqual({ type: 'text', content: '来自m1' })
    expect(m1.received.length).toBe(1)
    expect(m2.received.length).toBe(0)
  })
})

describe('POST /api/chat 参数校验', () => {
  it('body 为非法 JSON 时返回 400 {error}', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, '{oops')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
  })

  it('messages 缺失时返回 400', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, { model: 'm1' })
    expect(res.status).toBe(400)
  })

  it('messages 为空数组时返回 400', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, { messages: [] })
    expect(res.status).toBe(400)
  })
})

describe('适配器异常', () => {
  it('chatStream 抛错时仍返回 SSE，以 error chunk 收尾保持线协议可解析', async () => {
    const registry = new ModelRegistry().registerAdapter(
      'boom',
      errorAdapter('上游炸了'),
      { name: '爆炸模型', description: '演示异常路径' },
    )
    const app = createChatGateway({ models: registry })

    const res = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const chunks = parseChunks(await res.text())
    expect(chunks).toContainEqual({ type: 'error', content: '上游炸了' })
    expect(chunks[chunks.length - 1].type).toBe('error')
  })
})

describe('onComplete 流收尾钩子', () => {
  it('消费完整响应后调用一次，携带累积的助手消息与原始请求体', async () => {
    const script: StreamChunk[] = [
      { type: 'thinking', content: '想想' },
      { type: 'text', content: '你' },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 't1',
          toolName: 'get_weather',
          toolArguments: { city: '上海' },
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: { toolCallId: 't1', toolResult: { temp: 25 }, duration: 820 },
      },
      { type: 'text', content: '好' },
      { type: 'done', content: '' },
    ]
    const fake = fakeAdapter(script)
    const registry = new ModelRegistry().registerAdapter('m1', fake.adapter, {
      name: '模型一',
      description: '演示模型一',
      provider: 'mock',
    })
    const results: ChatCompletionResult[] = []
    const app = createChatGateway({
      models: registry,
      chat: {
        onComplete: (result) => {
          results.push(result)
        },
      },
    })

    const requestBody = {
      messages: [{ role: 'user', content: 'hi' }],
      conversationId: 'c9',
    }
    const res = await postChat(app, requestBody)
    await res.text()
    await vi.waitFor(() => expect(results.length).toBe(1))

    const result = results[0]
    expect(result.model).toBe('m1')
    expect(result.body).toEqual(requestBody)
    expect(result.assistant.role).toBe('assistant')
    expect(result.assistant.content).toBe('你好')
    expect(result.assistant.thinking).toEqual({ content: '想想' })
    expect(result.assistant.toolCalls?.[0]).toEqual({
      id: 't1',
      name: 'get_weather',
      arguments: { city: '上海' },
      result: { temp: 25 },
      status: 'completed',
      duration: 820,
    })
    expect(result.aborted).toBe(false)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('CORS', () => {
  it('默认开启：带 Origin 的请求响应 access-control-allow-origin 回源', async () => {
    const { registry } = makeRegistry()
    const app = createChatGateway({ models: registry })

    const res = await app.request('/api/models', {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    )
  })
})
