import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { LibSQLVector } from '@mastra/libsql'
import {
  createDocsVectorStore,
  DOCS_INDEX_NAME,
  ensureIndex,
} from '../../src/rag/vector-store'

/** :memory: 真连 LibSQLVector（真第三方实现，非 mock 自证） */
function memoryStore(): LibSQLVector {
  return new LibSQLVector({ id: 'test-vector', url: ':memory:' })
}

describe('ensureIndex', () => {
  it('索引不存在时按给定维度创建（cosine）', async () => {
    const store = memoryStore()
    await ensureIndex(store, 1024)
    const indexes = await store.listIndexes()
    expect(indexes).toContain(DOCS_INDEX_NAME)
    expect(
      await store.describeIndex({ indexName: DOCS_INDEX_NAME }),
    ).toMatchObject({
      dimension: 1024,
      metric: 'cosine',
    })
  })

  it('维度一致时幂等复用', async () => {
    const store = memoryStore()
    await ensureIndex(store, 8)
    await ensureIndex(store, 8)
    expect(
      await store.describeIndex({ indexName: DOCS_INDEX_NAME }),
    ).toMatchObject({
      dimension: 8,
    })
  })

  it('维度不匹配时报「重建」提示（换模型=换维度=重建索引）', async () => {
    const store = memoryStore()
    await ensureIndex(store, 8)
    await expect(ensureIndex(store, 4)).rejects.toThrow(/重建/)
  })

  it('rebuild=true 删旧建新，维度切换不再报错', async () => {
    const store = memoryStore()
    await ensureIndex(store, 8)
    await ensureIndex(store, 4, { rebuild: true })
    expect(
      await store.describeIndex({ indexName: DOCS_INDEX_NAME }),
    ).toMatchObject({
      dimension: 4,
    })
  })
})

describe('createDocsVectorStore', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'vector-store-test-'))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  it('返回 LibSQLVector 实例并按自定义 dbUrl 落盘', async () => {
    const dbUrl = `file:${join(tmp, 'docs-vector.db')}`
    const store = createDocsVectorStore(dbUrl)
    expect(store).toBeInstanceOf(LibSQLVector)
    // 真连一次：建索引触发文件落盘，验证 ensureDbDir 生效
    await ensureIndex(store, 4)
    const stats = await store.describeIndex({ indexName: DOCS_INDEX_NAME })
    expect(stats.dimension).toBe(4)
  })
})
