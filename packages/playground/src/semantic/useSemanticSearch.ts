/**
 * 会话语义搜索编排（18-03）：特征提取 → 向量入库（localStorage 持久化）→
 * 余弦 Top-K。端侧模型缺席时降级为 12-03 关键字匹配，功能不消失。
 */
import { readonly, ref } from 'vue'
import {
  MODEL_ID,
  createEdgeEmbedder,
  type EdgeEmbedder,
} from './edge-embedder'
import {
  cosineTopK,
  describeConversation,
  keywordSearch,
  type Scored,
  type SearchableConversation,
} from './pure'

export const INDEX_STORAGE_KEY = 'ai-chat-pg:edge-search-vectors'
const INDEX_VERSION = 1

/** localStorage 同契约的最小子集（测试注入内存实现） */
export interface PersistentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface PersistedIndex {
  version: number
  model: string
  vectors: { id: string; vector: number[] }[]
}

export interface SemanticSearchOptions {
  conversations: () => ReadonlyArray<SearchableConversation>
  embedder?: EdgeEmbedder
  storage?: PersistentStorage
  topK?: number
}

export interface SemanticTiming {
  embedMs: number
  scanMs: number
}

/** 读取并校验持久化索引；损坏 / 版本或模型不符 → null（视为待重建） */
function readPersistedIndex(storage: PersistentStorage): PersistedIndex | null {
  let raw: string | null
  try {
    raw = storage.getItem(INDEX_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as PersistedIndex).version !== INDEX_VERSION ||
      (parsed as PersistedIndex).model !== MODEL_ID ||
      !Array.isArray((parsed as PersistedIndex).vectors)
    ) {
      return null
    }
    const vectors = (parsed as PersistedIndex).vectors
    if (
      !vectors.every(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof v.id === 'string' &&
          Array.isArray(v.vector) &&
          v.vector.every((n) => typeof n === 'number' && Number.isFinite(n)),
      )
    ) {
      return null
    }
    return { version: INDEX_VERSION, model: MODEL_ID, vectors }
  } catch {
    return null
  }
}

export function createSemanticSearch(options: SemanticSearchOptions) {
  const embedder = options.embedder ?? createEdgeEmbedder()
  const storage: PersistentStorage | undefined =
    options.storage ??
    (typeof localStorage !== 'undefined'
      ? (localStorage as PersistentStorage)
      : undefined)
  const topK = options.topK ?? 5

  const query = ref('')
  const searching = ref(false)
  const indexing = ref(false)
  const indexedCount = ref(0)
  const semanticResults = ref<Scored[]>([])
  const keywordResults = ref<Scored[]>([])
  const degraded = ref(false)
  const timing = ref<SemanticTiming | null>(null)

  /** 向量库 = 内存 Map（几百条会话暴力遍历毫秒级，不需要专业向量库） */
  const vectors = new Map<string, number[]>()
  let warmPromise: Promise<void> | null = null

  const restored = storage ? readPersistedIndex(storage) : null
  if (restored) {
    for (const { id, vector } of restored.vectors) vectors.set(id, vector)
    indexedCount.value = vectors.size
  } else if (storage) {
    try {
      storage.removeItem(INDEX_STORAGE_KEY)
    } catch {
      // 存储只读等异常：降级为不持久化，不影响内存索引
    }
  }

  function persist(): void {
    if (!storage) return
    // 只保留当前会话集合的向量：已删除会话的陈旧向量随保存修剪
    const alive = new Set(options.conversations().map((c) => c.id))
    const payload: PersistedIndex = {
      version: INDEX_VERSION,
      model: MODEL_ID,
      vectors: [...vectors.entries()]
        .filter(([id]) => alive.has(id))
        .map(([id, vector]) => ({ id, vector })),
    }
    try {
      storage.setItem(INDEX_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // 超配额等写入失败：索引仍在内存，本次会话可用
    }
    indexedCount.value = payload.vectors.length
  }

  /** 向量入库：逐条 embed「标题+首条用户消息」截断文本 */
  async function indexAll(): Promise<boolean> {
    if (indexing.value) return true
    indexing.value = true
    try {
      for (const c of options.conversations()) {
        if (vectors.has(c.id)) continue
        const vec = await embedder.embed(describeConversation(c))
        if (!vec) return false
        vectors.set(c.id, Array.from(vec))
      }
      persist()
      return true
    } finally {
      indexing.value = false
    }
  }

  /** 懒加载预热：加载模型 + 全量入库，不产生查询结果 */
  function warmUp(): Promise<void> {
    if (warmPromise) return warmPromise
    warmPromise = (async () => {
      const fn = await embedder.load()
      if (!fn) return
      await indexAll()
    })().catch(() => {
      // 预热失败可重试（模型加载失败已由 embedder 状态表达）
    })
    const settle = warmPromise
    void settle.then(() => {
      if (embedder.status.value === 'error') warmPromise = null
    })
    return warmPromise
  }

  async function search(raw: string): Promise<void> {
    const q = raw.trim()
    if (!q || searching.value) return
    query.value = q
    searching.value = true
    degraded.value = false
    keywordResults.value = keywordSearch(
      q,
      options.conversations().map((c) => ({ id: c.id, title: c.title })),
    )
    try {
      await warmUp()
      const t0 = Date.now()
      const qv = await embedder.embed(q)
      const t1 = Date.now()
      if (!qv) throw new Error('embed unavailable')
      const items = [...vectors.entries()].map(([id, vector]) => ({
        id,
        vector,
      }))
      semanticResults.value = cosineTopK(qv, items, topK)
      timing.value = { embedMs: t1 - t0, scanMs: Date.now() - t1 }
    } catch {
      // 端侧不可用：语义轨降级为关键字结果（三级降级的最后一跳）
      semanticResults.value = keywordResults.value
      degraded.value = true
      timing.value = null
    } finally {
      searching.value = false
    }
  }

  return {
    embedder,
    query: readonly(query),
    searching: readonly(searching),
    indexing: readonly(indexing),
    indexedCount: readonly(indexedCount),
    semanticResults: readonly(semanticResults),
    keywordResults: readonly(keywordResults),
    degraded: readonly(degraded),
    timing: readonly(timing),
    isIndexed: (id: string) => vectors.has(id),
    warmUp,
    search,
  }
}

export type SemanticSearchEngine = ReturnType<typeof createSemanticSearch>
