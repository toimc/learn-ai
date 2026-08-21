import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelRegistry } from '@toimc/agents'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'
import { createMastraModel } from '@toimc/agents/mastra'
import { createMockApp } from '../app'
import { readMastraEnv, registerMastraAgent } from './register'
import { attachMastraInstance } from './index'

/** vi.mock 工厂在模块提升阶段执行，fake 对象必须经 vi.hoisted 共享 */
const fakes = vi.hoisted(() => {
  const fakeAdapter = {
    async *chatStream() {},
    async chat() {
      return { content: '', model: 'mastra-agent' }
    },
  }
  const fakeMemory = { __marker: 'default-memory' }
  const fakeStore = { __marker: 'libsql-store' }
  const fakeAgent = { __marker: 'agent' }
  return { fakeAdapter, fakeMemory, fakeStore, fakeAgent }
})

vi.mock('@toimc/agents/mastra', () => ({
  createMastraModel: vi.fn(() => ({
    adapter: fakes.fakeAdapter,
    info: { name: 'n', description: 'd', provider: 'mastra' },
    agent: fakes.fakeAgent,
  })),
}))

// LibSQLStore 构造函数立即执行 WAL PRAGMA（落盘），测试内必须替换实现；
// mock 实现须为 function 形式（实现代码以 new 调用）
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

// app.ts 的 telemetry 接线目标；mock 以避免真实构造 Mastra（OpenTelemetry 全局副作用）
vi.mock('./index', () => ({
  mastraInstance: null,
  attachMastraInstance: vi.fn(),
}))

const ENV_KEYS = [
  'MASTRA_MODEL',
  'MASTRA_MODEL_URL',
  'MASTRA_MODEL_NAME',
  'MASTRA_TELEMETRY',
] as const

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
  vi.restoreAllMocks()
})

describe('readMastraEnv', () => {
  it('空环境返回 null（不注册）', () => {
    expect(readMastraEnv({})).toBe(null)
  })

  it('MASTRA_MODEL 为空字符串同样返回 null', () => {
    expect(readMastraEnv({ MASTRA_MODEL: '' })).toBe(null)
  })

  it('仅 MASTRA_MODEL 时返回只含 model 的配置', () => {
    expect(
      readMastraEnv({ MASTRA_MODEL: 'deepseek/deepseek-chat' }),
    ).toStrictEqual({
      model: 'deepseek/deepseek-chat',
    })
  })

  it('URL / NAME 可选字段透传', () => {
    expect(
      readMastraEnv({
        MASTRA_MODEL: 'deepseek/deepseek-chat',
        MASTRA_MODEL_URL: 'https://api.example.com/v1',
        MASTRA_MODEL_NAME: 'DeepSeek Chat',
      }),
    ).toStrictEqual({
      model: 'deepseek/deepseek-chat',
      modelUrl: 'https://api.example.com/v1',
      modelName: 'DeepSeek Chat',
    })
  })

  it('可选字段为空字符串时不进入结果（falsy 剔除）', () => {
    expect(
      readMastraEnv({
        MASTRA_MODEL: 'deepseek/deepseek-chat',
        MASTRA_MODEL_URL: '',
        MASTRA_MODEL_NAME: '',
      }),
    ).toStrictEqual({ model: 'deepseek/deepseek-chat' })
  })
})

describe('registerMastraAgent', () => {
  it('以 mastra-agent 注册 adapter 与 info，返回 createMastraModel 产物', () => {
    const registry = new ModelRegistry()
    const spy = vi.spyOn(registry, 'registerAdapter')

    const customMemory = { __marker: 'custom-memory' }
    const created = registerMastraAgent(
      registry,
      { model: 'deepseek/deepseek-chat' },
      { memory: customMemory },
    )

    expect(spy).toHaveBeenCalledWith('mastra-agent', fakes.fakeAdapter, {
      name: 'n',
      description: 'd',
      provider: 'mastra',
    })
    expect(registry.has('mastra-agent')).toBe(true)
    expect(registry.get('mastra-agent').adapter).toBe(fakes.fakeAdapter)
    expect(created.agent).toBe(fakes.fakeAgent)
  })

  it('overrides.memory 传入时不再构造 LibSQLStore / Memory', () => {
    const registry = new ModelRegistry()
    const customMemory = { __marker: 'custom-memory' }

    registerMastraAgent(
      registry,
      { model: 'deepseek/deepseek-chat' },
      { memory: customMemory },
    )

    expect(vi.mocked(LibSQLStore)).not.toHaveBeenCalled()
    expect(vi.mocked(Memory)).not.toHaveBeenCalled()
    expect(vi.mocked(createMastraModel)).toHaveBeenCalledWith(
      expect.objectContaining({ memory: customMemory }),
    )
  })

  it('未传 overrides 时构造默认 Memory（file:.temp/mastra.db）并注入', () => {
    const registry = new ModelRegistry()

    registerMastraAgent(registry, { model: 'deepseek/deepseek-chat' })

    expect(vi.mocked(LibSQLStore)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(LibSQLStore)).toHaveBeenCalledWith({
      id: 'mastra-memory',
      url: 'file:.temp/mastra.db',
    })
    expect(vi.mocked(Memory)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createMastraModel)).toHaveBeenCalledWith(
      expect.objectContaining({ memory: fakes.fakeMemory }),
    )
  })

  it('modelUrl / modelName 透传：model 组装为 { id, url }，name 用展示名', () => {
    const registry = new ModelRegistry()

    registerMastraAgent(registry, {
      model: 'deepseek/deepseek-chat',
      modelUrl: 'https://api.example.com/v1',
      modelName: 'DeepSeek Chat',
    })

    expect(vi.mocked(createMastraModel)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: {
          id: 'deepseek/deepseek-chat',
          url: 'https://api.example.com/v1',
        },
        name: 'DeepSeek Chat',
      }),
    )
  })
})

describe('app 集成：MASTRA_MODEL 门控', () => {
  it('MASTRA_MODEL 存在时 /api/models 含 4 个模型且注册 mastra-agent', async () => {
    process.env.MASTRA_MODEL = 'deepseek/deepseek-chat'
    const app = createMockApp()

    const { models } = (await (await app.request('/api/models')).json()) as {
      models: { id: string }[]
    }

    expect(models.map((m) => m.id)).toEqual([
      'mock-pro',
      'mock-flash',
      'mock-thinking',
      'mastra-agent',
    ])
  })

  it('无 MASTRA_MODEL 时仍为 3 个 mock 模型（回归钉死）', async () => {
    const app = createMockApp()

    const { models } = (await (await app.request('/api/models')).json()) as {
      models: { id: string }[]
    }

    expect(models.map((m) => m.id)).toEqual([
      'mock-pro',
      'mock-flash',
      'mock-thinking',
    ])
  })

  it('MASTRA_TELEMETRY=true 时装配 Mastra 实例并挂载 agent', () => {
    process.env.MASTRA_MODEL = 'deepseek/deepseek-chat'
    process.env.MASTRA_TELEMETRY = 'true'

    createMockApp()

    expect(vi.mocked(attachMastraInstance)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(attachMastraInstance)).toHaveBeenCalledWith({
      'mastra-agent': fakes.fakeAgent,
    })
  })

  it('MASTRA_TELEMETRY 未开启时不装配 Mastra 实例', () => {
    process.env.MASTRA_MODEL = 'deepseek/deepseek-chat'

    createMockApp()

    expect(vi.mocked(attachMastraInstance)).not.toHaveBeenCalled()
  })
})
