import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LibSQLVector } from '@mastra/libsql'
import type { BatchEmbedder } from '../../src/rag/embedder'
import { buildDocsIndex } from '../../src/rag/index-docs'
import { DOCS_INDEX_NAME } from '../../src/rag/vector-store'

/**
 * 确定性假 embedder：向量 = [文本长度, 常量1]。
 * 与实现零共享代码；查询时用与目标块等长的文本即可精确命中预期块。
 */
const fakeEmbedder: BatchEmbedder = {
  async doEmbed({ values }) {
    return { embeddings: values.map((v) => [v.length, 1]) }
  },
}

let tmpRoot: string
let store: LibSQLVector

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'index-docs-test-'))
  mkdirSync(join(tmpRoot, 'components'), { recursive: true })
  writeFileSync(
    join(tmpRoot, 'components', 'button.md'),
    [
      '---',
      'title: Button 按钮',
      'layout: page',
      '---',
      '',
      '# Button',
      '',
      '## 基础用法',
      '',
      '按钮用于开始一个即时操作。' +
        '点击触发 click 事件，支持加载状态。'.repeat(6),
      '',
      '## 主题定制',
      '',
      '通过 CSS 变量 --ai-chat-color-accent 覆盖主色。' +
        '圆角用 --ai-chat-radius-md 控制。'.repeat(4),
      '',
    ].join('\n'),
  )
  mkdirSync(join(tmpRoot, 'guide'), { recursive: true })
  writeFileSync(
    join(tmpRoot, 'guide', 'theming.md'),
    [
      '# 主题系统',
      '',
      '## 暗色模式',
      '',
      'data-theme 属性切换明暗。' +
        '语义令牌三层结构：原始色阶、语义翻转、组件引用。'.repeat(5),
    ].join('\n'),
  )
  // ⚠️ 不能用 ':memory:'：@mastra/libsql 1.21.0 的写事务连接与主连接是两个独立
  // 内存库，upsert 后主连接丢表（探针实测）。文件库无此问题。
  store = new LibSQLVector({
    id: 'test-index-docs',
    url: `file:${join(tmpRoot, 'docs-vector.db')}`,
  })
})

afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }))

describe('buildDocsIndex', () => {
  it('全量入库：统计正确、metadata 带 source/title/text、frontmatter 不进块', async () => {
    const stats = await buildDocsIndex({
      docsRoot: tmpRoot,
      store,
      embedder: fakeEmbedder,
    })
    expect(stats.docs).toBe(2)
    expect(stats.chunks).toBeGreaterThan(0)
    expect(stats.dimension).toBe(2)

    // 用与「暗色模式」块等长的查询文本精确命中，验证 metadata 形状
    const queryText = '语义令牌三层结构原始色阶语义翻转组件引用'.repeat(2)
    const hits = await store.query({
      indexName: DOCS_INDEX_NAME,
      queryVector: [queryText.length, 1],
      topK: 1,
    })
    expect(hits[0].metadata).toMatchObject({
      source: 'guide/theming.md',
      title: '主题系统',
    })
    // frontmatter 的 layout 键被剥掉，不进任何块文本
    const all = await store.query({
      indexName: DOCS_INDEX_NAME,
      queryVector: [1, 1],
      topK: 100,
    })
    expect(
      all.every((h) => !String(h.metadata?.text).includes('layout:')),
    ).toBe(true)
  })

  it('重复入库幂等：块数不翻倍（全量 truncate 后重灌）', async () => {
    const first = await buildDocsIndex({
      docsRoot: tmpRoot,
      store,
      embedder: fakeEmbedder,
    })
    const second = await buildDocsIndex({
      docsRoot: tmpRoot,
      store,
      embedder: fakeEmbedder,
    })
    expect(second.chunks).toBe(first.chunks)
    const stats = await store.describeIndex({ indexName: DOCS_INDEX_NAME })
    expect(stats.count).toBe(second.chunks)
  })

  it('换模型换维度重跑自动重建（drop+create 避开向量索引 shadow row 坑）', async () => {
    const dim3: BatchEmbedder = {
      async doEmbed({ values }) {
        return { embeddings: values.map((v) => [v.length, 1, 0]) }
      },
    }
    const stats = await buildDocsIndex({
      docsRoot: tmpRoot,
      store,
      embedder: dim3,
    })
    expect(stats.dimension).toBe(3)
    expect(
      await store.describeIndex({ indexName: DOCS_INDEX_NAME }),
    ).toMatchObject({
      dimension: 3,
    })
  })

  it('空目录报可读错误', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'index-docs-empty-'))
    try {
      await expect(
        buildDocsIndex({ docsRoot: empty, store, embedder: fakeEmbedder }),
      ).rejects.toThrow(/未找到文档/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
