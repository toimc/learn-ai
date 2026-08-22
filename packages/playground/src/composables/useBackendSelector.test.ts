import { describe, expect, it, vi, afterEach } from 'vitest'
import { BACKEND_STORAGE_KEY, useBackendSelector } from './useBackendSelector'

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

function okResponse(): Response {
  return new Response('{}', { status: 200 })
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('useBackendSelector', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('初始 backend 从 localStorage 读取合法值', () => {
    const selector = useBackendSelector({
      storage: memoryStorage({ 'pg.backend': 'mastra' }),
    })
    expect(selector.backend.value).toBe('mastra')
  })

  it('storage 缺失或非法值时回退 local', () => {
    expect(useBackendSelector({ storage: memoryStorage() }).backend.value).toBe(
      'local',
    )
    expect(
      useBackendSelector({
        storage: memoryStorage({ 'pg.backend': 'someone-else' }),
      }).backend.value,
    ).toBe('local')
  })

  it('selectBackend(local) 不发网络请求并立即持久化', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const storage = memoryStorage({ 'pg.backend': 'mastra' })

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('local')

    expect(ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(selector.backend.value).toBe('local')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBe('local')
  })

  it('selectBackend(mastra) 探活 GET /api/agents 与 GET /api/app/model，成功后切换并持久化', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const storage = memoryStorage()

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('mastra')

    expect(ok).toBe(true)
    // 探活 + 运行时模型配置两连发
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map((call) => call[0] as string).sort()
    expect(urls).toEqual([
      'http://localhost:4111/api/agents',
      'http://localhost:4111/api/app/model',
    ])
    const agentsCall = fetchMock.mock.calls.find(
      (call) => call[0] === 'http://localhost:4111/api/agents',
    ) as [string, RequestInit]
    expect(agentsCall[1].method).toBe('GET')
    expect(agentsCall[1].signal).toBeInstanceOf(AbortSignal)
    expect(selector.backend.value).toBe('mastra')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBe('mastra')
    expect(selector.isOffline('mastra')).toBe(false)
  })

  it('mastra 在线且 GET /api/app/model 返回 config 时 customModelActive 为 true 并透出配置', async () => {
    const config = {
      name: '2api 中转',
      provider: 'openai-compat',
      model: 'gpt-test-mini',
      baseURL: 'https://api.example.com/v1',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/api/app/model'))
          return Promise.resolve(jsonResponse({ config }))
        return Promise.resolve(okResponse())
      }),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })

    expect(selector.customModelActive.value).toBe(false)
    await selector.selectBackend('mastra')

    expect(selector.customModelActive.value).toBe(true)
    expect(selector.mastraRuntimeConfig.value).toEqual(config)
  })

  it('config 为 null（未配置运行时模型）时 customModelActive 保持 false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/api/app/model'))
          return Promise.resolve(jsonResponse({ config: null }))
        return Promise.resolve(okResponse())
      }),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })
    await selector.selectBackend('mastra')

    expect(selector.mastraOnline.value).toBe(true)
    expect(selector.customModelActive.value).toBe(false)
    expect(selector.mastraRuntimeConfig.value).toBeNull()
  })

  it('mastra 离线时 customModelActive 恒 false（即使本地残留旧配置也会清空）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })
    const ok = await selector.selectBackend('mastra')

    expect(ok).toBe(false)
    expect(selector.customModelActive.value).toBe(false)
    expect(selector.mastraRuntimeConfig.value).toBeNull()
  })

  it('refreshCustomModel 单独刷新运行时模型状态（探活后配置端点变化时复用）', async () => {
    let config: { name: string } | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/api/app/model'))
          return Promise.resolve(jsonResponse({ config }))
        return Promise.resolve(okResponse())
      }),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })
    await selector.selectBackend('mastra')
    expect(selector.customModelActive.value).toBe(false)

    config = { name: '新模型' }
    await selector.refreshCustomModel()

    expect(selector.customModelActive.value).toBe(true)
    expect(selector.mastraRuntimeConfig.value).toEqual({ name: '新模型' })
  })

  it('mastra 探活失败（HTTP 500）时不切换、不持久化并标记离线', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 500 })),
    )
    const storage = memoryStorage()

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('mastra')

    expect(ok).toBe(false)
    expect(selector.backend.value).toBe('local')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBeNull()
    expect(selector.isOffline('mastra')).toBe(true)
  })

  it('mastra 服务未启动（fetch reject）标记离线而不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })

    await expect(selector.selectBackend('mastra')).resolves.toBe(false)
    expect(selector.isOffline('mastra')).toBe(true)
  })

  it('selectBackend(mock-server) 复用 checkHealth：探活 GET /api/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const storage = memoryStorage()

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('mock-server')

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8787/api/health')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBe('mock-server')
  })

  it('probeAll 并行探测两个远端并更新在线标志', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      // 4111 探活失败、8787 在线：按 URL 区分，不依赖调用顺序
      if (url.includes('4111'))
        return Promise.resolve(new Response('', { status: 404 }))
      return Promise.resolve(okResponse())
    })
    vi.stubGlobal('fetch', fetchMock)

    const selector = useBackendSelector({ storage: memoryStorage() })
    await selector.probeAll()

    expect(selector.mockServerOnline.value).toBe(true)
    expect(selector.mastraOnline.value).toBe(false)
    // 探测不改变当前选中
    expect(selector.backend.value).toBe('local')
  })
})
