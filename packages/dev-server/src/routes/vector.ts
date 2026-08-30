import { Hono } from 'hono'
import type { DevServerEnv, EmbeddingEnv } from '../env'
import { readDevServerEnv } from '../env'
import {
  createDocsVectorStore,
  DOCS_INDEX_NAME,
  DOCS_VECTOR_STORE_DESC,
} from '../rag/vector-store'
import { runSearch } from '../tools/search-docs'

/** stats 端点只依赖的两个只读方法（测试可注入替身） */
interface VectorStatsStore {
  listIndexes(): Promise<string[]>
  describeIndex(args: { indexName: string }): Promise<{
    count: number
    dimension: number
    metric: string
  }>
}

export interface VectorRoutesDeps {
  /** env 读取（异步签名对齐装配层风格；缺省读进程 env） */
  env?: () =>
    Promise<Pick<DevServerEnv, 'embedding'>> | Pick<DevServerEnv, 'embedding'>
  /** 向量库工厂（stats 用；缺省真连 .temp/docs-vector.db） */
  createStore?: () => VectorStatsStore
}

/** 向量检索演示端点：库统计 + 关键词/语义两路对比（docs 页 vector-search-demo 数据源） */
export function createVectorRoutes(deps: VectorRoutesDeps = {}) {
  const readEnv = deps.env ?? (() => readDevServerEnv())
  const createStore = deps.createStore ?? (() => createDocsVectorStore())

  const app = new Hono()

  app.get('/stats', async (c) => {
    const { embedding } = await readEnv()
    if (!embedding) return c.json({ enabled: false })

    const base = {
      enabled: true,
      model: embedding.model,
      url: embedding.url,
      vector: DOCS_VECTOR_STORE_DESC,
    }
    try {
      const store = createStore()
      const indexes = await store.listIndexes()
      if (!indexes.includes(DOCS_INDEX_NAME)) {
        return c.json({ ...base, indexExists: false })
      }
      const stats = await store.describeIndex({ indexName: DOCS_INDEX_NAME })
      return c.json({
        ...base,
        indexExists: true,
        chunks: stats.count,
        dimension: stats.dimension,
        metric: stats.metric,
      })
    } catch (error) {
      // 读库失败不崩：演示页可显示原因并引导排查
      return c.json({
        ...base,
        indexExists: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.post('/search', async (c) => {
    let query: string
    try {
      const body = (await c.req.json()) as { query?: unknown }
      if (typeof body.query !== 'string' || body.query.trim().length === 0) {
        return c.json({ error: 'query 必填（非空字符串）' }, 400)
      }
      query = body.query
    } catch {
      return c.json({ error: '请求体须为 JSON' }, 400)
    }

    // 双路对比：强制 embedding:null 得纯关键词基线；另一路走 env 实况（含降级）
    const keyword = await runSearch([query], undefined, { embedding: null })
    const hybrid = await runSearch([query])
    return c.json({
      query,
      keyword: { results: keyword.results },
      hybrid: { results: hybrid.results, mode: hybrid.mode },
      mode: hybrid.mode,
      degradedReason: hybrid.degradedReason ?? null,
      // 链路演示：两路各自耗时（vectorMs=0 即未配置，非失败）
      timing: { keyword: keyword.timing, hybrid: hybrid.timing },
    })
  })

  return app
}

/** 消费端类型（前端 demo 的 fetch 返回形状） */
export interface VectorStats {
  enabled: boolean
  model?: string
  url?: string
  indexExists?: boolean
  chunks?: number
  dimension?: number
  metric?: string
  error?: string
}

export interface VectorSearchResponse {
  query: string
  keyword: {
    results: Array<{
      source: string
      title: string
      snippet: string
      score: number
      matchedTerms: string[]
    }>
  }
  hybrid: {
    results: Array<{
      source: string
      title: string
      snippet: string
      score: number
      matchedTerms: string[]
    }>
    mode: string
  }
  mode: string
  degradedReason: string | null
  timing: {
    keyword: { keywordMs: number; vectorMs: number; totalMs: number }
    hybrid: { keywordMs: number; vectorMs: number; totalMs: number }
  }
}

export type { EmbeddingEnv }
