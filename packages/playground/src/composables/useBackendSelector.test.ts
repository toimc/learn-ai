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

describe('useBackendSelector', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('初始 backend 从 localStorage 读取合法值', () => {
    const selector = useBackendSelector({
      storage: memoryStorage({ 'pg.backend': 'dev-server' }),
    })
    expect(selector.backend.value).toBe('dev-server')
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

  it('旧值迁移：storage 预置 mock-server 时初值映射为 dev-server', () => {
    const selector = useBackendSelector({
      storage: memoryStorage({ 'pg.backend': 'mock-server' }),
    })
    expect(selector.backend.value).toBe('dev-server')
  })

  it('旧值迁移：storage 预置 mastra 时初值映射为 dev-server', () => {
    const selector = useBackendSelector({
      storage: memoryStorage({ 'pg.backend': 'mastra' }),
    })
    expect(selector.backend.value).toBe('dev-server')
  })

  it('旧值迁移：未知值回退安全默认 local', () => {
    const selector = useBackendSelector({
      storage: memoryStorage({ 'pg.backend': 'unknown-backend' }),
    })
    expect(selector.backend.value).toBe('local')
  })

  it('selectBackend(local) 不发网络请求并立即持久化', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const storage = memoryStorage({ 'pg.backend': 'dev-server' })

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('local')

    expect(ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(selector.backend.value).toBe('local')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBe('local')
  })

  it('selectBackend(dev-server) 复用 checkHealth：探活 GET /api/health，成功后切换并持久化', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)
    const storage = memoryStorage()

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('dev-server')

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8787/api/health')
    expect(selector.backend.value).toBe('dev-server')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBe('dev-server')
    expect(selector.serverOnline.value).toBe(true)
    expect(selector.isOffline('dev-server')).toBe(false)
  })

  it('探活 HTTP 500 时不切换、不持久化并标记离线', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 500 })),
    )
    const storage = memoryStorage()

    const selector = useBackendSelector({ storage })
    const ok = await selector.selectBackend('dev-server')

    expect(ok).toBe(false)
    expect(selector.backend.value).toBe('local')
    expect(storage.getItem(BACKEND_STORAGE_KEY)).toBeNull()
    expect(selector.isOffline('dev-server')).toBe(true)
  })

  it('服务未启动（fetch reject）标记离线而不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const selector = useBackendSelector({ storage: memoryStorage() })

    await expect(selector.selectBackend('dev-server')).resolves.toBe(false)
    expect(selector.isOffline('dev-server')).toBe(true)
  })

  it('probeAll 探测唯一远端并更新 serverOnline（探测不改变当前选中）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const selector = useBackendSelector({ storage: memoryStorage() })
    expect(selector.serverOnline.value).toBeNull()

    await selector.probeAll()

    expect(selector.serverOnline.value).toBe(true)
    expect(selector.backend.value).toBe('local')
  })
})
