import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ProviderFormPayload } from '@toimc/vue'
import {
  fetchMastraRuntimeModel,
  removeMastraRuntimeModel,
  saveMastraRuntimeModel,
} from './mastra-runtime-model'

const BASE = 'http://localhost:4111'

const CONFIG = {
  name: '2api 中转',
  provider: 'openai-compat',
  model: 'gpt-test-mini',
  baseURL: 'https://api.example.com/v1',
}

const PAYLOAD: ProviderFormPayload = {
  name: '2api 中转',
  provider: 'openai-compat',
  baseURL: 'https://api.example.com/v1',
  apiKey: 'sk-runtime-secret',
  model: 'gpt-test-mini',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('mastra 运行时模型 API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('fetchMastraRuntimeModel GET /api/app/model，透出脱敏 config（null 视为未配置）', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ config: CONFIG }))
    vi.stubGlobal('fetch', fetchMock)

    const config = await fetchMastraRuntimeModel(BASE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/app/model`)
    expect(init.method).toBe('GET')
    expect(config).toEqual(CONFIG)
  })

  it('config 为 null 时 fetchMastraRuntimeModel 返回 null 而非抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ config: null })),
    )
    expect(await fetchMastraRuntimeModel(BASE)).toBeNull()
  })

  it('fetchMastraRuntimeModel 非 2xx 抛出含状态码的错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 502 })),
    )
    await expect(fetchMastraRuntimeModel(BASE)).rejects.toThrow('HTTP 502')
  })

  it('saveMastraRuntimeModel POST 表单载荷到 /api/app/model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await saveMastraRuntimeModel(BASE, PAYLOAD)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/app/model`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD)
  })

  it('saveMastraRuntimeModel 非 2xx 抛出含状态码的错误（载荷不重复发送）', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'name is required' }, 400))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveMastraRuntimeModel(BASE, PAYLOAD)).rejects.toThrow(
      'HTTP 400',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('removeMastraRuntimeModel DELETE /api/app/model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await removeMastraRuntimeModel(BASE)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE}/api/app/model`)
    expect(init.method).toBe('DELETE')
  })

  it('removeMastraRuntimeModel 非 2xx 抛出含状态码的错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('err', { status: 500 })),
    )
    await expect(removeMastraRuntimeModel(BASE)).rejects.toThrow('HTTP 500')
  })
})
