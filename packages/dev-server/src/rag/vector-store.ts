import { LibSQLVector } from '@mastra/libsql'
import { ensureDbDir, tempDbUrl } from '../memory'

/** 文档语义索引名（LibSQLVector 内建表名，命名规范：字母开头字母数字下划线） */
export const DOCS_INDEX_NAME = 'docs_chunks'

/** 向量库默认落盘：包根 .temp/docs-vector.db。与会话记忆 dev-server.db 分文件——
 * 文档索引是可随时重建的派生数据（pnpm index:docs），删库重灌不伤对话历史 */
const DOCS_VECTOR_DB_URL = tempDbUrl('docs-vector.db')

/** 文档向量库工厂（测试可用 :memory: 或临时文件） */
export function createDocsVectorStore(
  dbUrl: string = DOCS_VECTOR_DB_URL,
): LibSQLVector {
  ensureDbDir(dbUrl)
  return new LibSQLVector({ id: 'dev-server-docs-vector', url: dbUrl })
}

/**
 * 确保索引存在且维度与当前 embedding 模型一致。
 * 换模型 = 换维度 = 旧向量空间作废：不 rebuild 时显式报错而非静默写坏数据。
 */
export async function ensureIndex(
  store: LibSQLVector,
  dimension: number,
  options: { rebuild?: boolean } = {},
): Promise<void> {
  const indexes = await store.listIndexes()
  const exists = indexes.includes(DOCS_INDEX_NAME)
  if (exists && options.rebuild) {
    await store.deleteIndex({ indexName: DOCS_INDEX_NAME })
  }
  if (!exists || options.rebuild) {
    await store.createIndex({
      indexName: DOCS_INDEX_NAME,
      dimension,
      metric: 'cosine',
    })
    return
  }
  const stats = await store.describeIndex({ indexName: DOCS_INDEX_NAME })
  if (stats.dimension !== dimension) {
    throw new Error(
      `向量索引维度不匹配：现有 ${stats.dimension} 维，当前 embedding 模型输出 ${dimension} 维。` +
        '换模型必须重建索引：pnpm index:docs --rebuild',
    )
  }
}
