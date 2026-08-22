import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { createApp } from './create-app'

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}
const FINISH_REASON = { unified: 'stop', raw: 'stop' }

/**
 * 无网络无 key 的最小 LanguageModelV3 mock：doStream 同步产出固定 text chunk
 * 序列（spec 12 附录 A 的帧样例采集亦基于此形态）
 */
function makeMockModel(deltas: string[]) {
  return {
    specificationVersion: 'v3' as const,
    provider: 'mock' as const,
    modelId: 'mock-model' as const,
    supportedUrls: {} as Record<string, RegExp[]>,
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: 't0' })
          for (const delta of deltas) {
            controller.enqueue({ type: 'text-delta', id: 't0', delta })
          }
          controller.enqueue({ type: 'text-end', id: 't0' })
          controller.enqueue({
            type: 'finish',
            usage: USAGE,
            finishReason: FINISH_REASON,
          })
          controller.close()
        },
      }),
    }),
    doGenerate: async () => ({
      content: [{ type: 'text', text: deltas.join('') }],
      finishReason: FINISH_REASON,
      usage: USAGE,
      warnings: [],
    }),
  }
}

/** 测试专用 Mastra：chat-agent 挂 mock model（不带 memory，免落盘） */
function makeTestMastra() {
  const chatAgent = new Agent({
    id: 'chat-agent',
    name: 'chat-agent',
    model: makeMockModel(['你好', '，', '世界']) as ConstructorParameters<
      typeof Agent
    >[0]['model'],
    instructions: '测试指令',
  })
  return new Mastra({ agents: { 'chat-agent': chatAgent } })
}

/**
 * 从 SSE 文本解出全部 data 帧 JSON 载荷。
 * 跳过非 JSON 的 `data: [DONE]` 终止帧（@mastra/hono stream 端点的实际收尾形态）
 */
function parseSse(body: string): Record<string, unknown>[] {
  return body.split('\n\n').flatMap((frame) =>
    frame
      .split('\n')
      .filter(
        (line) => line.startsWith('data:') && !line.startsWith('data: [DONE]'),
      )
      .map(
        (line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>,
      ),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createApp 端点', () => {
  it('GET /health 公开返回 ok（未设 token 时）', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/agents 列出 chat-agent', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/agents')
    expect(res.status).toBe(200)
    expect(JSON.stringify(await res.json())).toContain('chat-agent')
  })

  it('设 MASTRA_APP_TOKEN 后 /api/agents 无 Bearer 返回 401 Unauthorized', async () => {
    vi.stubEnv('MASTRA_APP_TOKEN', 'test-token')
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/agents')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('设 MASTRA_APP_TOKEN 后 /health 仍公开（健康探活不进认证）', async () => {
    vi.stubEnv('MASTRA_APP_TOKEN', 'test-token')
    const app = await createApp(makeTestMastra())
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('设 MASTRA_APP_TOKEN 后正确 Bearer 放行', async () => {
    vi.stubEnv('MASTRA_APP_TOKEN', 'test-token')
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/agents', {
      headers: { authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/agents/chat-agent/stream（mock model 无 key 验证）', () => {
  it('返回 SSE：data 帧含 text-delta 增量与 finish 收尾', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/agents/chat-agent/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '打个招呼' }],
      }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const rawBody = await res.text()
    const frames = parseSse(rawBody)
    expect(frames.length).toBeGreaterThan(0)
    const types = frames.map((f) => f.type)
    // spec 12 §4.1 映射表：Mastra 原生事件名 text-delta / finish 上 HTTP 线
    expect(types).toContain('text-delta')
    expect(types).toContain('finish')
    // text-delta 载荷字段是 payload.text（附录 A 实测），全部增量拼出 mock 模型固定输出
    const text = frames
      .filter((f) => f.type === 'text-delta')
      .map((f) => String((f.payload as Record<string, unknown>).text))
      .join('')
    expect(text).toBe('你好，世界')
    // 流以非 JSON 的 data: [DONE] 帧收尾（附录 A 实测）
    expect(rawBody).toContain('data: [DONE]')
  })
})
