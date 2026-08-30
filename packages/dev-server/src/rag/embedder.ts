import { ModelRouterEmbeddingModel } from '@mastra/core/llm'
import type { EmbeddingEnv } from '../env'

/**
 * 语义检索的 embedding 模型工厂。
 * url 场景走 createOpenAICompatible（标准 /embeddings 协议，读 core dist 源码确认），
 * provider 名仅作标识不进注册表——本地 Ollama / 云端 OpenAI 兼容端点同一条路径。
 * 构造不发网络请求，首次 doEmbed 才连端点。
 */
export function createEmbedder(env: EmbeddingEnv): ModelRouterEmbeddingModel {
  // 裸模型名（bge-m3）补本地 Ollama 前缀；含 provider/ 的模型串原样透传
  const id = env.model.includes('/') ? env.model : `ollama/${env.model}`
  return new ModelRouterEmbeddingModel({ id, url: env.url, apiKey: env.apiKey })
}

/** embedBatch 的最小依赖面（测试可注入替身，不绑具体实现类） */
export interface BatchEmbedder {
  doEmbed(args: { values: string[] }): Promise<{ embeddings: number[][] }>
}

/**
 * 分批嵌入并按原顺序展平。
 * 批量上限不依赖模型侧的 maxEmbeddingsPerCall（Ollama 大批量易超时），按 32/批保守切。
 */
export async function embedBatch(
  embedder: BatchEmbedder,
  texts: string[],
  batchSize = 32,
): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const { embeddings } = await embedder.doEmbed({
      values: texts.slice(i, i + batchSize),
    })
    out.push(...embeddings)
  }
  return out
}
