import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { MDocument } from '@mastra/rag'
import type { LibSQLVector } from '@mastra/libsql'
import { collectMdFiles, DOCS_ROOT } from './docs-corpus'
import type { BatchEmbedder } from './embedder'
import { embedBatch } from './embedder'
import { DOCS_INDEX_NAME, ensureIndex } from './vector-store'

/** 标题行等碎片块低于此长度不入库（冒烟实测 markdown 切块会产出 4-15 字的纯标题块） */
const MIN_CHUNK_CHARS = 30

/** markdown 切块粒度：512 字符约对应 bge-m3 语义单元，overlap 保留跨块上下文 */
const CHUNK_OPTIONS = { maxSize: 512, overlap: 50 } as const

/** 入库批大小：embed 与 upsert 同批（Ollama 大批量易超时，保守切） */
const UPSERT_BATCH = 32

export interface BuildDocsIndexOptions {
  /** 语料根目录，默认 packages/docs */
  docsRoot?: string
  store: LibSQLVector
  embedder: BatchEmbedder
}

export interface DocsIndexStats {
  docs: number
  chunks: number
  dimension: number
  durationMs: number
}

/** VitePress frontmatter（--- 包围的键值区）是站点配置噪音，切块前剥掉 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
}

/**
 * 全量入库管线：收集 md → markdown 切块 → 探测定维 → ensureIndex →
 * truncate 清旧 → 分批 embed + upsert（metadata 携带 source/title/text，
 * 检索端取回片段不回读源文件）。
 */
export async function buildDocsIndex(
  options: BuildDocsIndexOptions,
): Promise<DocsIndexStats> {
  const start = Date.now()
  const docsRoot = options.docsRoot ?? DOCS_ROOT
  const files = collectMdFiles(docsRoot)
  if (files.length === 0) {
    throw new Error(`未找到文档（${docsRoot} 下无 .md），请确认在仓库内运行`)
  }

  const pieces: Array<{
    text: string
    metadata: { source: string; title: string }
  }> = []
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const source = relative(docsRoot, file)
    const title = content.match(/^#\s+(.+)$/m)?.[1] ?? source
    const doc = MDocument.fromMarkdown(stripFrontmatter(content), {
      source,
      title,
    })
    const chunks = await doc.chunk({ strategy: 'markdown', ...CHUNK_OPTIONS })
    for (const chunk of chunks) {
      const text = (chunk.text ?? '').trim()
      if (text.length < MIN_CHUNK_CHARS) continue
      pieces.push({ text, metadata: { source, title } })
    }
  }
  if (pieces.length === 0) {
    throw new Error('全部文档切块为空，请检查语料内容')
  }

  // 探针取实际维度（免配置：bge-m3=1024、text-embedding-3-small=1536 自动适配）
  const probe = await options.embedder.doEmbed({ values: [pieces[0].text] })
  const dimension = probe.embeddings[0]!.length
  // 全量管线一律删旧建新而非 truncate：libsql 向量索引（DiskANN）DELETE 后重插
  // 会报 "failed to insert shadow row"（实测 @mastra/libsql 1.21.0），drop+create
  // 是唯一稳妥的全量重建路径，顺带天然兼容换模型换维度
  await ensureIndex(options.store, dimension, { rebuild: true })

  for (let i = 0; i < pieces.length; i += UPSERT_BATCH) {
    const batch = pieces.slice(i, i + UPSERT_BATCH)
    const vectors = await embedBatch(
      options.embedder,
      batch.map((p) => p.text),
    )
    await options.store.upsert({
      indexName: DOCS_INDEX_NAME,
      vectors,
      metadata: batch.map((p) => ({ ...p.metadata, text: p.text })),
    })
  }

  return {
    docs: files.length,
    chunks: pieces.length,
    dimension,
    durationMs: Date.now() - start,
  }
}
