/**
 * 会话语义搜索的纯逻辑层（18-03）：无框架、无 IO，可独立测试。
 * 唯一被 @huggingface/transformers 依赖的加载逻辑见 edge-embedder.ts。
 */

/** 向量化的输入对象形状（会话或其投影） */
export interface SearchableConversation {
  id: string
  title: string
  messages: ReadonlyArray<{ role: string; content: string }>
}

export interface Scored {
  id: string
  score: number
}

/** 向量化输入文本：标题 + 首条用户消息，截断控制单次 embedding 耗时 */
export function describeConversation(
  c: SearchableConversation,
  maxLen = 200,
): string {
  const firstUser = c.messages.find((m) => m.role === 'user')?.content ?? ''
  return `${c.title} ${firstUser}`.slice(0, maxLen)
}

/**
 * 余弦相似度 Top-K：向量已归一化（normalized: true），余弦退化为点积，省一次开方。
 * 维度不一致的条目（换模型后的陈旧索引）直接跳过，等价于待重建。
 */
export function cosineTopK(
  query: ReadonlyArray<number> | Float32Array,
  items: ReadonlyArray<{ id: string; vector: ReadonlyArray<number> }>,
  k = 5,
): Scored[] {
  if (query.length === 0 || items.length === 0) return []
  const scored: Scored[] = []
  for (const item of items) {
    if (item.vector.length !== query.length) continue
    let dot = 0
    for (let i = 0; i < query.length; i++) {
      dot += query[i] * item.vector[i]
    }
    scored.push({ id: item.id, score: dot })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k)
}

/** 12-03 基线的标题关键字匹配：indexOf 式字面包含，大小写不敏感 */
export function keywordSearch(
  query: string,
  items: ReadonlyArray<{ id: string; title: string }>,
): Scored[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items
    .filter((item) => item.title.toLowerCase().includes(q))
    .map((item) => ({ id: item.id, score: 1 }))
}

export type SearchBackend = 'webgpu' | 'wasm' | 'keyword'

/** 三级降级决策：WebGPU 优先 → WASM 回退 → 关键字匹配兜底 */
export function resolveBackend(
  hasWebGPU: boolean,
  hasWASM: boolean,
): SearchBackend {
  if (hasWebGPU) return 'webgpu'
  if (hasWASM) return 'wasm'
  return 'keyword'
}
