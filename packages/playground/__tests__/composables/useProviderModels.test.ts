import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  useProviderModels,
  SELECTED_MODEL_STORAGE_KEY,
} from '../../src/composables/useProviderModels'
import type { ProviderFormPayload } from '@toimc/vue'

/** 注入用内存 storage：记录写入便于断言“绝存 apiKey” */
function memoryStorage() {
  const map = new Map<string, string>()
  const writes: Array<{ key: string; value: string }> = []
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
      writes.push({ key, value })
    },
    removeItem: (key: string) => map.delete(key),
  }
  return { storage, map, writes }
}

const MODELS_PAYLOAD = {
  models: [
    { id: 'mock-pro', name: 'Mock Pro', description: '均衡演示模型' },
    { id: 'custom-1', name: 'DeepSeek', description: '运行时注册' },
  ],
}

const PROVIDERS_PAYLOAD = {
  providers: [
    {
      id: 'custom-1',
      name: 'DeepSeek',
      provider: 'openai-compat',
      model: 'deepseek-chat',
    },
  ],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** GET /api/models + /api/providers 两连发（含可选 POST 注册）的 fetch 桩 */
function stubOnlineGets() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (
      url.endsWith('/api/models') &&
      (!init || init.method === undefined || init.method === 'GET')
    ) {
      return jsonResponse(MODELS_PAYLOAD)
    }
    if (url.endsWith('/api/providers') && init?.method === 'POST') {
      return jsonResponse(
        {
          id: 'custom-2',
          name: 'Kimi',
          provider: 'openai-compat',
          model: 'moonshot-v1-8k',
        },
        201,
      )
    }
    if (
      url.endsWith('/api/providers') &&
      (!init || init.method === undefined || init.method === 'GET')
    ) {
      return jsonResponse(PROVIDERS_PAYLOAD)
    }
    throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${url}`)
  })
}

const payload: ProviderFormPayload = {
  name: 'Kimi',
  provider: 'openai-compat',
  baseURL: 'https://api.moonshot.cn/v1',
  apiKey: 'sk-test-secret',
  model: 'moonshot-v1-8k',
}

describe('useProviderModels', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('refresh 拉取模型与 provider 列表并置为在线', async () => {
    vi.stubGlobal('fetch', stubOnlineGets())
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    expect(pm.status.value).toBe('connecting')
    expect(pm.selectedModelId.value).toBeUndefined()

    await pm.refresh()

    expect(pm.status.value).toBe('online')
    expect(pm.models.value.map((m) => m.id)).toEqual(['mock-pro', 'custom-1'])
    expect(pm.models.value[1].name).toBe('DeepSeek')
    expect(pm.providers.value).toEqual(PROVIDERS_PAYLOAD.providers)
  })

  it('选中模型只把 id 写入 storage，绝写入 apiKey', async () => {
    const fetchMock = stubOnlineGets()
    vi.stubGlobal('fetch', fetchMock)
    const { storage, writes } = memoryStorage()

    const pm = useProviderModels({ storage })
    await pm.refresh()
    // createProvider 成功即自动选中 custom-2（写入一次），再手动切换到 custom-1
    await pm.createProvider(payload)
    pm.selectModel('custom-1')

    expect(storage.getItem(SELECTED_MODEL_STORAGE_KEY)).toBe('custom-1')
    // 模型选择的全部写入值均为纯模型 id，不包含任何密钥痕迹
    // （saved-providers 键是「记住配置」功能的独立通道，密钥安全性由其专属用例覆盖）
    const modelWrites = writes.filter(
      (w) => w.key === SELECTED_MODEL_STORAGE_KEY,
    )
    expect(modelWrites.length).toBeGreaterThan(0)
    for (const w of modelWrites) {
      expect(['custom-2', 'custom-1']).toContain(w.value)
    }
    expect(JSON.stringify(modelWrites)).not.toContain('sk-test-secret')

    // 取消选择清除持久化
    pm.selectModel(undefined)
    expect(storage.getItem(SELECTED_MODEL_STORAGE_KEY)).toBeNull()
    expect(pm.selectedModelId.value).toBeUndefined()
  })

  it('再次进入时从 storage 恢复上次选中的模型 id', () => {
    vi.stubGlobal('fetch', stubOnlineGets())
    const { storage } = memoryStorage()
    storage.setItem(SELECTED_MODEL_STORAGE_KEY, 'custom-1')

    const pm = useProviderModels({ storage })
    expect(pm.selectedModelId.value).toBe('custom-1')
  })

  it('createProvider POST 表单载荷并刷新列表', async () => {
    const created = {
      id: 'custom-2',
      name: 'Kimi',
      provider: 'openai-compat',
      model: 'moonshot-v1-8k',
    }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/providers') && init?.method === 'POST') {
        return jsonResponse(created, 201)
      }
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse(PROVIDERS_PAYLOAD)
      throw new Error(`unexpected ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    const option = await pm.createProvider(payload)

    expect(option).toEqual(created)
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    )
    expect(post?.[0]).toBe('http://localhost:8787/api/providers')
    expect(JSON.parse(post?.[1]?.body as string)).toEqual(payload)
    // 注册成功后刷新（POST 之后又发起了 GET）
    const gets = fetchMock.mock.calls.filter(
      ([, init]) => !init || init.method === 'GET',
    )
    expect(gets.length).toBeGreaterThanOrEqual(2)
  })

  it('removeProvider DELETE 指定 id 并刷新列表', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return jsonResponse({ ok: true })
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse({ providers: [] })
      throw new Error(`unexpected ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    await pm.refresh()
    await pm.removeProvider('custom-1')

    const del = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'DELETE',
    )
    expect(del?.[0]).toBe('http://localhost:8787/api/providers/custom-1')
    expect(pm.providers.value).toEqual([])
  })

  it('服务端不可达时进入离线态且不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    await expect(pm.refresh()).resolves.toBeUndefined()

    expect(pm.status.value).toBe('offline')
    expect(pm.models.value).toEqual([])
    expect(pm.providers.value).toEqual([])
  })

  it('createProvider 收到非 2xx 时抛出可读错误', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return jsonResponse({ error: 'name is required' }, 400)
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse(PROVIDERS_PAYLOAD)
      throw new Error(`unexpected ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    await expect(pm.createProvider(payload)).rejects.toThrow('HTTP 400')
  })

  it('refresh 后发现选中 id 已失效（服务端重启/删除）时自动回退默认', async () => {
    vi.stubGlobal('fetch', stubOnlineGets())
    const { storage } = memoryStorage()
    // 服务端 registry 是进程内存态：重启后 custom-1 消失，浏览器持久化的旧 id 成为幽灵值
    storage.setItem(SELECTED_MODEL_STORAGE_KEY, 'ghost-9')

    const pm = useProviderModels({ storage })
    await pm.refresh()

    expect(pm.selectedModelId.value).toBeUndefined()
    expect(storage.getItem(SELECTED_MODEL_STORAGE_KEY)).toBeNull()
  })

  it('createProvider 成功后自动选中新注册的模型', async () => {
    vi.stubGlobal('fetch', stubOnlineGets())
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    await pm.createProvider(payload)

    expect(pm.selectedModelId.value).toBe('custom-2')
    expect(storage.getItem(SELECTED_MODEL_STORAGE_KEY)).toBe('custom-2')
  })

  it('persist 未显式为 false 时表单配置（含 apiKey）追加进 saved-providers 存储', async () => {
    vi.stubGlobal('fetch', stubOnlineGets())
    const { storage } = memoryStorage()

    const pm = useProviderModels({ storage })
    await pm.createProvider({ ...payload, persist: true })
    await pm.createProvider({ ...payload, name: 'One-off', persist: false })

    const saved = JSON.parse(
      storage.getItem('ai-chat-playground:saved-providers') ?? '[]',
    )
    expect(saved).toEqual([
      {
        name: 'Kimi',
        provider: 'openai-compat',
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: 'sk-test-secret',
        model: 'moonshot-v1-8k',
      },
    ])
  })

  it('removeProvider 删除成功后按 name/provider/model 匹配移除存储条目', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return jsonResponse({ ok: true })
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse(PROVIDERS_PAYLOAD)
      throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()
    // 预置条目与 PROVIDERS_PAYLOAD 的 custom-1（DeepSeek）三元组一致，删除即联动移除
    storage.setItem(
      'ai-chat-playground:saved-providers',
      JSON.stringify([
        {
          name: 'DeepSeek',
          provider: 'openai-compat',
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: 'sk-test-secret',
          model: 'deepseek-chat',
        },
      ]),
    )

    const pm = useProviderModels({ storage })
    await pm.refresh()
    await pm.removeProvider('custom-1')

    expect(
      JSON.parse(storage.getItem('ai-chat-playground:saved-providers') ?? '[]'),
    ).toEqual([])
  })

  it('restoreSavedProviders 逐条静默重注册，失败条目剔除、成功条目保留', async () => {
    const saved = [
      {
        name: 'Kimi',
        provider: 'openai-compat',
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: 'sk-1',
        model: 'moonshot-v1-8k',
      },
      {
        name: 'Dead',
        provider: 'openai-compat',
        baseURL: 'https://dead.example/v1',
        apiKey: 'sk-2',
        model: 'gone',
      },
    ]
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/providers') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        // Dead 配置注册失败（服务端校验或上游异常的静默形态）
        if (body.name === 'Dead') return jsonResponse({ error: 'nope' }, 400)
        return jsonResponse(
          { id: 'custom-9', name: body.name, provider: 'openai-compat' },
          201,
        )
      }
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse(PROVIDERS_PAYLOAD)
      throw new Error(`unexpected ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()
    storage.setItem('ai-chat-playground:saved-providers', JSON.stringify(saved))

    const pm = useProviderModels({ storage })
    await pm.restoreSavedProviders()

    expect(
      JSON.parse(storage.getItem('ai-chat-playground:saved-providers') ?? '[]'),
    ).toEqual([saved[0]])
  })
})

describe('updateProvider', () => {
  it('PUT 指定 id 并联动替换 localStorage 持久化条目', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT')
        return jsonResponse({
          id: 'custom-1',
          name: 'Renamed',
          provider: 'openai-compat',
          model: 'new-model',
          baseURL: 'https://new.example/v1',
        })
      if (url.endsWith('/api/models')) return jsonResponse(MODELS_PAYLOAD)
      if (url.endsWith('/api/providers')) return jsonResponse(PROVIDERS_PAYLOAD)
      throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { storage } = memoryStorage()
    storage.setItem(
      'ai-chat-playground:saved-providers',
      JSON.stringify([
        {
          name: 'DeepSeek',
          provider: 'openai-compat',
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: 'sk-old',
          model: 'deepseek-chat',
        },
      ]),
    )

    const pm = useProviderModels({ storage })
    await pm.refresh()
    await pm.updateProvider('custom-1', {
      name: 'Renamed',
      provider: 'openai-compat',
      baseURL: 'https://new.example/v1',
      apiKey: 'sk-new',
      model: 'new-model',
      persist: true,
    })

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(put?.[0]).toBe('http://localhost:8787/api/providers/custom-1')
    expect(
      JSON.parse(storage.getItem('ai-chat-playground:saved-providers') ?? '[]'),
    ).toEqual([
      {
        name: 'Renamed',
        provider: 'openai-compat',
        baseURL: 'https://new.example/v1',
        apiKey: 'sk-new',
        model: 'new-model',
      },
    ])
  })
})
