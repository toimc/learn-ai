import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createMastraModel } from '@toimc/agents/mastra'
import { createDevApp } from '../../src/app'
import { getTimeTool } from '../../src/tools/get-time'
import { getWeatherTool } from '../../src/tools/get-weather'

/**
 * 运行时 Provider 路由测试。
 * createMastraModel / LibSQLStore / Memory 全部打桩
 * （避免真实构造 Agent 与 SQLite 落盘）。
 * 注意：custom-{n} 为模块级递增计数（进程语义），文件内按用例顺序锚定字面量。
 */
const fakes = vi.hoisted(() => {
  const fakeAdapter = {
    async *chatStream() {},
    async chat() {
      return { content: '', model: 'custom' }
    },
  }
  const fakeAgent = { __marker: 'agent' }
  const fakeMemory = { __marker: 'default-memory' }
  const fakeStore = { __marker: 'libsql-store' }
  return { fakeAdapter, fakeAgent, fakeMemory, fakeStore }
})

vi.mock('@toimc/agents/mastra', () => ({
  // 实现为 async 工厂（内部动态加载 @mastra/core），mock 保持同形态
  createMastraModel: vi.fn(async () => ({
    adapter: fakes.fakeAdapter,
    info: { name: 'n', description: 'd', provider: 'mastra' },
    agent: fakes.fakeAgent,
  })),
}))

// LibSQLStore 构造函数立即执行 WAL PRAGMA（落盘），测试内必须替换实现
vi.mock('@mastra/libsql', () => ({
  LibSQLStore: vi.fn(function () {
    return fakes.fakeStore
  }),
}))

vi.mock('@mastra/memory', () => ({
  Memory: vi.fn(function () {
    return fakes.fakeMemory
  }),
}))

type MockApp = Awaited<ReturnType<typeof createDevApp>>

function postProvider(app: MockApp, body: unknown) {
  return app.request('/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function listModelIds(app: MockApp): Promise<string[]> {
  const { models } = (await (await app.request('/api/models')).json()) as {
    models: { id: string }[]
  }
  return models.map((m) => m.id)
}

/** 纯 mock 环境（无 MASTRA_MODEL）下的基线模型清单 */
const MOCK_MODEL_IDS = ['mock-pro', 'mock-flash', 'mock-thinking']

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('POST /api/providers：正常注册', () => {
  it('openai-compat：201 返回 ProviderOption，createMastraModel 收到含 apiKey 的端点组装与工具/记忆，id 出现在 /api/models', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-deepseek-123',
      model: 'deepseek-chat',
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({
      id: 'custom-1',
      name: 'DeepSeek',
      provider: 'openai-compat',
      model: 'deepseek-chat',
    })
    expect(vi.mocked(createMastraModel)).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'custom-1',
        name: 'DeepSeek',
        model: {
          id: 'deepseek-chat',
          url: 'https://api.deepseek.com/v1',
          apiKey: 'sk-test-deepseek-123',
        },
        tools: { getTimeTool, getWeatherTool },
        memory: fakes.fakeMemory,
      }),
    )
    // 注册后对前端可见
    expect(await listModelIds(app)).toContain('custom-1')
  })

  it('anthropic：model 组装为 anthropic/ 前缀字符串，注册前注入 ANTHROPIC_API_KEY', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'Claude',
      provider: 'anthropic',
      apiKey: 'sk-ant-test-456',
      model: 'claude-sonnet-4-5',
    })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({
      id: 'custom-2',
      name: 'Claude',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
    })
    expect(vi.mocked(createMastraModel)).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-5' }),
    )
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test-456')
  })
})

describe('GET /api/providers', () => {
  it('仅返回运行时注册项，响应全文不含 apiKey 字样与密钥值', async () => {
    const app = await createDevApp()
    const registered = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-deepseek-123',
      model: 'deepseek-chat',
    })
    expect(registered.status).toBe(201)

    const res = await app.request('/api/providers')
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text.includes('apiKey')).toBe(false)
    expect(text.includes('sk-test-deepseek-123')).toBe(false)
    expect(JSON.parse(text)).toEqual({
      providers: [
        {
          id: 'custom-3',
          name: 'DeepSeek',
          provider: 'openai-compat',
          model: 'deepseek-chat',
        },
      ],
    })
  })

  it('未注册任何 provider 时返回空列表', async () => {
    const app = await createDevApp()
    const res = await app.request('/api/providers')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ providers: [] })
  })
})

describe('DELETE /api/providers/:id', () => {
  it('删除已注册项：200 { ok: true }，GET 列表与 /api/models 同步移除', async () => {
    const app = await createDevApp()
    const registered = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-deepseek-123',
      model: 'deepseek-chat',
    })
    expect(registered.status).toBe(201)

    const res = await app.request('/api/providers/custom-4', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const listRes = await app.request('/api/providers')
    expect(await listRes.json()).toEqual({ providers: [] })
    expect(await listModelIds(app)).toEqual(MOCK_MODEL_IDS)
  })

  it('不存在的 id 返回 404 且带 error 字段', async () => {
    const app = await createDevApp()
    const res = await app.request('/api/providers/custom-404', {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
  })
})

describe('POST /api/providers：校验失败（400）', () => {
  it('缺 apiKey 返回 400 且不触发注册', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'apiKey is required' })
    expect(vi.mocked(createMastraModel)).not.toHaveBeenCalled()
    expect(await listModelIds(app)).toEqual(MOCK_MODEL_IDS)
  })

  it('apiKey 为纯空白同样拒绝', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '   ',
      model: 'deepseek-chat',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'apiKey is required' })
  })

  it('缺 model 返回 400', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-deepseek-123',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'model is required' })
  })

  it('openai-compat 缺 baseURL 返回 400', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'DeepSeek',
      provider: 'openai-compat',
      apiKey: 'sk-test-deepseek-123',
      model: 'deepseek-chat',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'baseURL is required for openai-compat',
    })
  })

  it('name 为纯空白返回 400', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: '  ',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-deepseek-123',
      model: 'deepseek-chat',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'name is required' })
  })

  it('未知 provider 返回 400（fail-closed，仅接受 openai-compat / anthropic）', async () => {
    const app = await createDevApp()

    const res = await postProvider(app, {
      name: 'X',
      provider: 'google',
      apiKey: 'sk-test-deepseek-123',
      model: 'gemini-3-pro',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'provider must be openai-compat or anthropic',
    })
  })

  it('body 非 JSON（解析失败）按缺字段处理返回 400', async () => {
    const app = await createDevApp()

    const res = await app.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
  })
})
