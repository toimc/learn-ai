import { describe, expect, it, vi } from 'vitest'
import { createVectorRoutes } from '../../src/routes/vector'

/** stats 端点的最小 store 替身（结构兼容 LibSQLVector 的两个只读方法） */
function fakeStore(
  overrides: Partial<{
    indexes: string[]
    count: number
    dimension: number
  }> = {},
) {
  const indexes = overrides.indexes ?? ['docs_chunks']
  return {
    listIndexes: async () => indexes,
    describeIndex: async () => ({
      count: overrides.count ?? 471,
      dimension: overrides.dimension ?? 1024,
      metric: 'cosine',
    }),
  }
}

const embeddingEnv = {
  model: 'bge-m3',
  url: 'http://localhost:11434/v1',
  apiKey: 'ollama',
}

function app(deps: Parameters<typeof createVectorRoutes>[0] = {}) {
  return createVectorRoutes(deps)
}

describe('GET /stats', () => {
  it('EMBEDDING_MODEL 未配置：enabled=false（语义检索未启用）', async () => {
    const res = await app({ env: async () => ({ embedding: null }) }).request(
      '/stats',
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: false })
  })

  it('配置了模型但索引未建：indexExists=false，前端可提示先跑 pnpm index:docs', async () => {
    const res = await app({
      env: async () => ({ embedding: embeddingEnv }),
      createStore: () => fakeStore({ indexes: [] }),
    }).request('/stats')
    const body = await res.json()
    expect(body).toMatchObject({
      enabled: true,
      model: 'bge-m3',
      indexExists: false,
    })
  })

  it('索引正常：返回块数与维度（入库统计的运行时视图）', async () => {
    const res = await app({
      env: async () => ({ embedding: embeddingEnv }),
      createStore: () => fakeStore(),
    }).request('/stats')
    expect(await res.json()).toMatchObject({
      enabled: true,
      model: 'bge-m3',
      indexExists: true,
      chunks: 471,
      dimension: 1024,
    })
  })

  it('向量库读失败不崩：降级为 indexExists=false 带原因', async () => {
    const res = await app({
      env: async () => ({ embedding: embeddingEnv }),
      createStore: () =>
        ({
          listIndexes: async () => {
            throw new Error('boom')
          },
        }) as never,
    }).request('/stats')
    const body = await res.json()
    expect(body.enabled).toBe(true)
    expect(body.indexExists).toBe(false)
    expect(body.error).toContain('boom')
  })
})

describe('POST /search', () => {
  it('返回两路对比；未配置 embedding 时 hybrid 降级为 keyword 且与关键词路一致', async () => {
    vi.stubEnv('EMBEDDING_MODEL', '')
    delete process.env.EMBEDDING_MODEL
    try {
      const res = await app({ env: async () => ({ embedding: null }) }).request(
        '/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '聊天气泡' }),
        },
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.query).toBe('聊天气泡')
      expect(body.keyword.results.length).toBeGreaterThan(0)
      expect(body.keyword.results[0].source).toContain('message-bubble')
      expect(body.mode).toBe('keyword')
      // 链路耗时：未配置 embedding 时语义路 vectorMs=0（未尝试，非失败）
      expect(body.timing.hybrid.vectorMs).toBe(0)
      expect(body.timing.keyword.keywordMs).toBeGreaterThanOrEqual(0)
      // 两路一致：RRF 单路输入保序输出，source 序列相同
      expect(
        body.hybrid.results.map((r: { source: string }) => r.source),
      ).toEqual(body.keyword.results.map((r: { source: string }) => r.source))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('缺失 query 返回 400', async () => {
    const res = await app({ env: async () => ({ embedding: null }) }).request(
      '/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(400)
  })
})
