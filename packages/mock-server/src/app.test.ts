import { describe, expect, it, vi } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { createMockApp } from './app'

/** 从 SSE 文本里解出全部 chunk 载荷（与前端 sse-adapter 同构的简化解析） */
function parseChunks(body: string): StreamChunk[] {
  return body.split('\n\n').flatMap((frame) =>
    frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()) as StreamChunk),
  )
}

function postChat(
  app: Awaited<ReturnType<typeof createMockApp>>,
  messages: { role: string; content: string }[],
  extra: Record<string, unknown> = {},
) {
  return app.request('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, speed: 0, ...extra }),
  })
}

describe('conversations 路由', () => {
  it('GET /api/conversations 返回按时间倒序的种子会话', async () => {
    const app = await createMockApp()
    const res = await app.request('/api/conversations')
    expect(res.status).toBe(200)
    const { conversations } = (await res.json()) as {
      conversations: {
        id: string
        title: string
        messageCount: number
        updatedAt: string
      }[]
    }
    expect(conversations.length).toBeGreaterThanOrEqual(4)
    expect(conversations.map((c) => c.id)).toContain('conv_vue')
    // 倒序：前一项 updatedAt 不早于后一项
    for (let i = 1; i < conversations.length; i++) {
      expect(conversations[i - 1].updatedAt >= conversations[i].updatedAt).toBe(
        true,
      )
    }
  })

  it('GET /api/conversations/:id/messages 返回历史消息（含 thinking 与 toolCalls 形态）', async () => {
    const app = await createMockApp()
    const res = await app.request('/api/conversations/conv_arch/messages')
    expect(res.status).toBe(200)
    const { messages } = (await res.json()) as {
      messages: {
        role: string
        thinking?: { content: string; duration?: number }
      }[]
    }
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.thinking?.content)).toBe(true)
  })

  it('未知会话返回 404', async () => {
    const res = await (
      await createMockApp()
    ).request('/api/conversations/nope/messages')
    expect(res.status).toBe(404)
  })

  it('POST /api/conversations 创建空会话并出现在列表首位', async () => {
    const app = await createMockApp()
    const created = await app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '测试会话' }),
    })
    expect(created.status).toBe(201)
    const conv = (await created.json()) as { id: string; title: string }
    expect(conv.title).toBe('测试会话')

    const list = await (await app.request('/api/conversations')).json()
    expect(list.conversations[0].id).toBe(conv.id)
  })
})

describe('chat 路由（SSE）', () => {
  it('返回 text/event-stream，chunk 帧为 StreamChunk 且 done 收尾', async () => {
    const res = await postChat(await createMockApp(), [
      { role: 'user', content: '你好' },
    ])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const body = await res.text()
    expect(body).toContain('event: chunk')
    const chunks = parseChunks(body)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('工具剧本流式输出 tool_call → tool_result → text', async () => {
    const res = await postChat(await createMockApp(), [
      { role: 'user', content: '上海天气如何，用工具查一下' },
    ])
    const seq = parseChunks(await res.text()).map((c) => c.type)
    expect(seq.indexOf('tool_call')).toBeLessThan(seq.indexOf('tool_result'))
    expect(seq.indexOf('tool_result')).toBeLessThan(seq.indexOf('text'))
  })

  it('对话写回会话历史：发送后再取消息可见这一轮', async () => {
    const app = await createMockApp()
    // 消费完整响应体，确保流结束（写回发生在流收尾）
    const res = await postChat(app, [{ role: 'user', content: '思考一下' }], {
      conversationId: 'conv_vue',
    })
    await res.text()
    const { messages } = await (
      await app.request('/api/conversations/conv_vue/messages')
    ).json()
    // 种子 4 条 + 本轮用户/助手 2 条
    expect(messages.length).toBe(6)
    expect(messages[messages.length - 2].role).toBe('user')
    expect(messages[messages.length - 1].role).toBe('assistant')
  })

  it('messages 缺失返回 400', async () => {
    const res = await (
      await createMockApp()
    ).request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('辅助路由', () => {
  it('GET /api/models 返回模型列表', async () => {
    const app = await createMockApp()
    const { models } = await (await app.request('/api/models')).json()
    expect(models.length).toBeGreaterThanOrEqual(3)
    expect(models[0].id).toBe('mock-pro')
  })

  it('GET /api/health 探活', async () => {
    const res = await (await createMockApp()).request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('OpenAPI 规范', () => {
  it('GET /api/openapi.json 结构完整且本地 servers 指向本机', async () => {
    const res = await (await createMockApp()).request('/api/openapi.json')
    expect(res.status).toBe(200)
    const spec = (await res.json()) as {
      openapi: string
      servers: { url: string }[]
      paths: Record<string, Record<string, { tags?: string[] }>>
    }
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.servers[0].url).toBe('http://localhost:8787')

    // 每个操作都打了 tag（Scalar 左侧按 tag 分组）
    for (const ops of Object.values(spec.paths)) {
      for (const op of Object.values(ops)) {
        expect(Array.isArray(op.tags)).toBe(true)
      }
    }
  })

  it('VERCEL 函数环境下 servers 为空串（Scalar Test Request 同源）', async () => {
    vi.stubEnv('VERCEL', '1')
    vi.resetModules()
    const { createMockApp: freshCreateMockApp } = await import('./app')
    const res = await (await freshCreateMockApp()).request('/api/openapi.json')
    const spec = (await res.json()) as { servers: { url: string }[] }
    expect(spec.servers[0].url).toBe('')
    vi.unstubAllEnvs()
  })

  it('本地环境 servers 指向 8787（环境变量复位后）', async () => {
    const res = await (await createMockApp()).request('/api/openapi.json')
    const spec = (await res.json()) as { servers: { url: string }[] }
    expect(spec.servers[0].url).toBe('http://localhost:8787')
  })

  it('端点清单完整（原用例拆分保留）', async () => {
    const res = await (await createMockApp()).request('/api/openapi.json')
    const spec = (await res.json()) as {
      paths: Record<string, Record<string, { tags?: string[] }>>
    }

    const expected = [
      '/api/conversations',
      '/api/conversations/{id}/messages',
      '/api/chat',
      '/api/models',
      '/api/health',
    ]
    for (const path of expected) {
      expect(Object.keys(spec.paths)).toContain(path)
    }
    // 每个操作都打了 tag（Scalar 左侧按 tag 分组）
    for (const ops of Object.values(spec.paths)) {
      for (const op of Object.values(ops)) {
        expect(op.tags?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })
})
