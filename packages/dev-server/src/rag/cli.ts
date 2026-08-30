import { readDevServerEnv } from '../env'
import { createEmbedder } from './embedder'
import { buildDocsIndex } from './index-docs'
import { createDocsVectorStore } from './vector-store'

/**
 * 文档向量化入库 CLI：pnpm index:docs（在 packages/dev-server 下运行）。
 * 语料向量持久化在 .temp/docs-vector.db，查询时只 embed 查询文本——
 * 仅在文档变更或换 embedding 模型后需要重跑本命令。
 */
async function main(): Promise<void> {
  const env = readDevServerEnv()
  if (!env.embedding) {
    throw new Error(
      '缺少 EMBEDDING_MODEL（packages/dev-server/.env），语义检索未启用。' +
        '本地 Ollama 配置：EMBEDDING_MODEL=bge-m3',
    )
  }

  const embedder = createEmbedder(env.embedding)
  const store = createDocsVectorStore()
  console.log(
    `开始入库：模型 ${env.embedding.model} @ ${env.embedding.url}，语料 packages/docs`,
  )
  const stats = await buildDocsIndex({ store, embedder })
  console.log(
    `入库完成：${stats.docs} 篇文档 / ${stats.chunks} 个语义块 / ` +
      `${stats.dimension} 维 / 耗时 ${(stats.durationMs / 1000).toFixed(1)}s`,
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
