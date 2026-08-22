import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { createApp } from './create-app'
import {
  buildRuntimeModel,
  clearRuntimeModel,
  getRuntimeAgent,
  getRuntimeConfig,
  setRuntimeModel,
} from './runtime-model'
import type { RuntimeModelPayload } from './runtime-model'

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}
const FINISH_REASON = { unified: 'stop', raw: 'stop' }

/**
 * 无网络无 key 的最小 LanguageModelV3 mock（与 create-app.test.ts 同款），
 * doStream 直接收 abortSignal：中断时以 AbortError 拒绝，验证端点的静默语义
 */
function makeMockModel(deltas: string[]) {
  return {
    specificationVersion: 'v3' as const,
    provider: 'mock' as const,
    modelId: 'mock-model' as const,
    supportedUrls: {} as Record<string, RegExp[]>,
    doStream: async (options: { abortSignal?: AbortSignal }) => {
      options.abortSignal?.throwIfAborted()
      return {
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
      }
    },
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

/** 从 SSE 文本解出全部 data 帧 JSON 载荷（跳过 `data: [DONE]` 终止帧） */
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

const OPENAI_PAYLOAD: RuntimeModelPayload = {
  name: '2api 中转',
  provider: 'openai-compat',
  baseURL: 'https://api.example.com/v1',
  apiKey: 'sk-runtime-secret',
  model: 'gpt-test-mini',
}

const ANTHROPIC_PAYLOAD: RuntimeModelPayload = {
  name: 'Claude',
  provider: 'anthropic',
  apiKey: 'sk-ant-runtime-secret',
  model: 'claude-sonnet-4',
}

/** 注入 mock model 且不带 memory（免落盘），保持端点行为与真实装配一致 */
async function setMockRuntimeAgent(
  payload: RuntimeModelPayload,
  deltas = ['你好', '，', '世界'],
) {
  await setRuntimeModel(payload, {
    model: makeMockModel(deltas) as ConstructorParameters<
      typeof Agent
    >[0]['model'],
    memory: null,
  })
}

const originalAnthropicKey = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  clearRuntimeModel()
  vi.unstubAllEnvs()
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey
})

describe('buildRuntimeModel（payload → Mastra model 字段，语义同 mock-server registerRuntimeProvider）', () => {
  it('openai-compat 组装 { id: openai/<model>, url, apiKey }（附录 A.3：id 须带 provider 前缀、apiKey 显式进对象）', () => {
    expect(buildRuntimeModel(OPENAI_PAYLOAD)).toEqual({
      id: 'openai/gpt-test-mini',
      url: 'https://api.example.com/v1',
      apiKey: 'sk-runtime-secret',
    })
  })

  it('anthropic 组装 anthropic/<model> 路由串', () => {
    expect(buildRuntimeModel(ANTHROPIC_PAYLOAD)).toBe(
      'anthropic/claude-sonnet-4',
    )
  })
})

describe('runtime-model 状态', () => {
  it('setRuntimeModel 构造 custom-agent 并存脱敏配置（绝不含 apiKey）', async () => {
    await setMockRuntimeAgent(OPENAI_PAYLOAD)

    const agent = getRuntimeAgent()
    expect(agent).toBeInstanceOf(Agent)
    expect(getRuntimeConfig()).toEqual({
      name: '2api 中转',
      provider: 'openai-compat',
      model: 'gpt-test-mini',
      baseURL: 'https://api.example.com/v1',
    })
  })

  it('anthropic 注册前把 apiKey 注入 process.env.ANTHROPIC_API_KEY（Mastra 官方路由从 env 取）', async () => {
    await setMockRuntimeAgent(ANTHROPIC_PAYLOAD)
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-runtime-secret')
  })

  it('clearRuntimeModel 清空配置与 agent', async () => {
    await setMockRuntimeAgent(OPENAI_PAYLOAD)
    clearRuntimeModel()
    expect(getRuntimeConfig()).toBeUndefined()
    expect(getRuntimeAgent()).toBeUndefined()
  })
})

describe('POST /api/app/model', () => {
  it('合法载荷返回 { ok: true }，随后 GET 返回单条配置且响应绝不含 apiKey', async () => {
    const app = await createApp(makeTestMastra())
    const created = await app.request('/api/app/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(OPENAI_PAYLOAD),
    })
    expect(created.status).toBe(200)
    expect(await created.json()).toEqual({ ok: true })

    const res = await app.request('/api/app/model')
    expect(res.status).toBe(200)
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain('sk-runtime-secret')
    expect(JSON.parse(text)).toEqual({
      config: {
        name: '2api 中转',
        provider: 'openai-compat',
        model: 'gpt-test-mini',
        baseURL: 'https://api.example.com/v1',
      },
    })
  })

  it('未配置时 GET 返回 { config: null }', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/model')
    expect(await res.json()).toEqual({ config: null })
  })

  it('缺 name 返回 400 name is required', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...OPENAI_PAYLOAD, name: ' ' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'name is required' })
  })

  it('provider 非法返回 400', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...OPENAI_PAYLOAD, provider: 'google' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'provider must be openai-compat or anthropic',
    })
  })

  it('openai-compat 缺 baseURL 返回 400', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...OPENAI_PAYLOAD, baseURL: undefined }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'baseURL is required for openai-compat',
    })
  })

  it('DELETE 清空配置，GET 回到 { config: null }', async () => {
    const app = await createApp(makeTestMastra())
    await app.request('/api/app/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(OPENAI_PAYLOAD),
    })
    const res = await app.request('/api/app/model', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await (await app.request('/api/app/model')).json()).toEqual({
      config: null,
    })
  })

  it('设 MASTRA_APP_TOKEN 后 /api/app/model 无 Bearer 返回 401（与 /api/* 同挂）', async () => {
    vi.stubEnv('MASTRA_APP_TOKEN', 'test-token')
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/model')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})

describe('POST /api/app/agents/custom-agent/stream', () => {
  it('未配置运行时模型返回 404 no runtime model configured', async () => {
    const app = await createApp(makeTestMastra())
    const res = await app.request('/api/app/agents/custom-agent/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no runtime model configured' })
  })

  it('已配置时产出 SSE：首帧 start、text-delta 增量、末帧 finish、尾帧 [DONE]（对齐附录 A）', async () => {
    const app = await createApp(makeTestMastra())
    await setMockRuntimeAgent(OPENAI_PAYLOAD)

    const res = await app.request('/api/app/agents/custom-agent/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '打个招呼' }],
        memory: { thread: 't1', resource: 'ai-chat-playground' },
      }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const rawBody = await res.text()
    const frames = parseSse(rawBody)
    expect(frames[0]?.type).toBe('start')
    expect(frames[frames.length - 1]?.type).toBe('finish')
    expect(
      frames
        .filter((f) => f.type === 'text-delta')
        .map((f) => String((f.payload as Record<string, unknown>).text)),
    ).toEqual(['你好', '，', '世界'])
    expect(rawBody.endsWith('data: [DONE]\n\n')).toBe(true)
  })

  it('中断（signal 已 abort）静默结束：不产 error 帧也不补 [DONE]', async () => {
    const app = await createApp(makeTestMastra())
    await setMockRuntimeAgent(OPENAI_PAYLOAD)

    const controller = new AbortController()
    controller.abort()
    const res = await app.request('/api/app/agents/custom-agent/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: controller.signal,
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain('"type":"error"')
    expect(text).not.toContain('[DONE]')
  })
})
