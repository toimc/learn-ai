import { describe, expect, it, vi } from 'vitest'
import {
  createEdgeEmbedder,
  MODEL_ID,
  type EmbedFn,
} from '../../src/semantic/edge-embedder'
import {
  createSemanticSearch,
  INDEX_STORAGE_KEY,
} from '../../src/semantic/useSemanticSearch'
import type { SearchableConversation } from '../../src/semantic/pure'

/** 可注入的最小 Storage 形状（与浏览器 localStorage 同契约） */
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

const CONVS: SearchableConversation[] = [
  {
    id: 'c1',
    title: '聊聊 AI 交互体验',
    messages: [{ role: 'user', content: '长列表渲染卡顿怎么优化' }],
  },
  {
    id: 'c2',
    title: '组件库主题定制',
    messages: [{ role: 'user', content: '暗色模式颜色变量怎么改' }],
  },
]

/** 向量字典：索引文本（标题+首条用户消息）与查询文本 → 固定向量 */
const VECTORS: Record<string, number[]> = {
  '聊聊 AI 交互体验 长列表渲染卡顿怎么优化': [1, 0],
  '组件库主题定制 暗色模式颜色变量怎么改': [0, 1],
  浏览器性能优化: [0.75, 0.25],
  主题: [0.25, 0.75],
}

function makeEngine(overrides?: {
  embedFn?: EmbedFn
  storage?: Storage
  conversations?: SearchableConversation[]
}) {
  const embedFn =
    overrides?.embedFn ??
    (async (text: string) =>
      ({ data: Float32Array.from(VECTORS[text] ?? [0, 0]) }) as const)
  const embedder = createEdgeEmbedder({ loadPipeline: async () => embedFn })
  return createSemanticSearch({
    conversations: () => overrides?.conversations ?? CONVS,
    embedder,
    storage: overrides?.storage ?? new MemoryStorage(),
  })
}

describe('createSemanticSearch', () => {
  it('语义轨按余弦排序命中，且给出实测耗时（关键字轨 0 命中正是语义搜索的用武之地）', async () => {
    const engine = makeEngine()
    await engine.search('浏览器性能优化')
    // 手算：query=[0.75,0.25]（float32 精确）· c1=[1,0] → 0.75；c2=[0,1] → 0.25
    expect(engine.semanticResults.value).toEqual([
      { id: 'c1', score: 0.75 },
      { id: 'c2', score: 0.25 },
    ])
    expect(engine.keywordResults.value).toEqual([])
    expect(engine.degraded.value).toBe(false)
    expect(Number.isFinite(engine.timing.value?.embedMs ?? NaN)).toBe(true)
    expect(Number.isFinite(engine.timing.value?.scanMs ?? NaN)).toBe(true)
  })

  it('关键字轨按标题字面命中（12-03 基线）', async () => {
    const engine = makeEngine()
    await engine.search('主题')
    expect(engine.keywordResults.value).toEqual([{ id: 'c2', score: 1 }])
  })

  it('索引持久化到 storage，重启后免重算', async () => {
    const storage = new MemoryStorage()
    const spyFn = vi.fn(async (text: string) => ({
      data: Float32Array.from(VECTORS[text] ?? [0, 0]),
    }))
    const first = makeEngine({ embedFn: spyFn as unknown as EmbedFn, storage })
    await first.search('浏览器性能优化')
    spyFn.mockClear()

    // 持久化形状（手写期望，不含未索引字段）
    const persisted = JSON.parse(storage.getItem(INDEX_STORAGE_KEY) ?? 'null')
    expect(persisted).toEqual({
      version: 1,
      model: MODEL_ID,
      vectors: [
        { id: 'c1', vector: [1, 0] },
        { id: 'c2', vector: [0, 1] },
      ],
    })

    // 同一 storage 重建引擎：只重算查询向量，索引不再 embed
    const second = makeEngine({ embedFn: spyFn as unknown as EmbedFn, storage })
    await second.search('浏览器性能优化')
    expect(spyFn).toHaveBeenCalledTimes(1)
    expect(second.semanticResults.value).toEqual([
      { id: 'c1', score: 0.75 },
      { id: 'c2', score: 0.25 },
    ])
  })

  it('损坏的存储数据回退为空索引并重建', async () => {
    for (const bad of [
      '{not json',
      'null',
      JSON.stringify({ version: 1, vectors: 42 }),
    ]) {
      const storage = new MemoryStorage()
      storage.setItem(INDEX_STORAGE_KEY, bad)
      const engine = makeEngine({ storage })
      await engine.search('浏览器性能优化')
      const persisted = JSON.parse(storage.getItem(INDEX_STORAGE_KEY) ?? 'null')
      expect(persisted.model).toBe(MODEL_ID)
      expect(persisted.vectors).toHaveLength(2)
    }
  })

  it('模型标识不符的旧索引被丢弃重建（换模型=换维度=必须重建）', async () => {
    const storage = new MemoryStorage()
    storage.setItem(
      INDEX_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        model: 'Xenova/other-model',
        vectors: [{ id: 'c1', vector: [9, 9] }],
      }),
    )
    const engine = makeEngine({ storage })
    await engine.search('浏览器性能优化')
    const persisted = JSON.parse(storage.getItem(INDEX_STORAGE_KEY) ?? 'null')
    expect(persisted.model).toBe(MODEL_ID)
    expect(persisted.vectors).toContainEqual({ id: 'c1', vector: [1, 0] })
    expect(engine.semanticResults.value[0]).toEqual({ id: 'c1', score: 0.75 })
  })

  it('已删除会话的陈旧向量被修剪出持久化', async () => {
    const storage = new MemoryStorage()
    await makeEngine({ storage }).search('浏览器性能优化')
    const pruned = makeEngine({
      storage,
      conversations: [CONVS[0]],
    })
    await pruned.search('主题')
    const persisted = JSON.parse(storage.getItem(INDEX_STORAGE_KEY) ?? 'null')
    expect(persisted.vectors).toEqual([{ id: 'c1', vector: [1, 0] }])
  })

  it('端侧加载失败：语义轨降级为关键字结果且标记 degraded（功能不消失）', async () => {
    const embedder = createEdgeEmbedder({
      loadPipeline: async () => {
        throw new Error('offline')
      },
    })
    const engine = createSemanticSearch({
      conversations: () => CONVS,
      embedder,
      storage: new MemoryStorage(),
    })
    await engine.search('主题')
    expect(engine.keywordResults.value).toEqual([{ id: 'c2', score: 1 }])
    expect(engine.semanticResults.value).toEqual([{ id: 'c2', score: 1 }])
    expect(engine.degraded.value).toBe(true)
    expect(engine.timing.value).toBeNull()
  })

  it('空查询不触发检索', async () => {
    const spyFn = vi.fn(async (text: string) => ({
      data: Float32Array.from(VECTORS[text] ?? [0, 0]),
    }))
    const engine = makeEngine({ embedFn: spyFn as unknown as EmbedFn })
    await engine.search('   ')
    expect(engine.searching.value).toBe(false)
    expect(engine.semanticResults.value).toEqual([])
    expect(spyFn).not.toHaveBeenCalled()
  })

  it('warmUp 只准备模型与索引，不产生查询结果', async () => {
    const engine = makeEngine()
    await engine.warmUp()
    expect(engine.indexedCount.value).toBe(2)
    expect(engine.isIndexed('c1')).toBe(true)
    expect(engine.semanticResults.value).toEqual([])
  })
})
