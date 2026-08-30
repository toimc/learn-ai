/** 参与融合的单路检索结果（与 search_docs 返回结构同形） */
export interface FusionCandidate {
  source: string
  title: string
  snippet: string
  /** 所在路的原始分（向量路为 cosine 相似度，关键词路为 TF-IDF 加权分），只用于路内排序 */
  score: number
  matchedTerms: string[]
}

/** RRF 常数：rank 从 1 计，1/(k+rank)；业界标准 60，抑制两路分数量纲差异 */
const RRF_K = 60

/** 单路内某个 source 的最佳命中与路内名次 */
interface RouteHit {
  candidate: FusionCandidate
  rank: number
}

interface FusedEntry {
  vector?: RouteHit
  keyword?: RouteHit
}

/**
 * Reciprocal Rank Fusion：两路召回各按自身分数排名，按 source 融合。
 * 双路同 source 合并规则：snippet 取向量路（块级定位更精确），
 * matchedTerms 取关键词路（保留字面命中证据，纯向量命中为空数组）。
 */
export function rrfFuse(
  vectorHits: FusionCandidate[],
  keywordHits: FusionCandidate[],
  topK: number,
): FusionCandidate[] {
  const entries = new Map<string, FusedEntry>()
  const collect = (hits: FusionCandidate[], route: 'vector' | 'keyword') => {
    hits.forEach((hit, i) => {
      const entry = entries.get(hit.source) ?? {}
      // 各路按分数降序传入；同路同 source 只保留首个（分更高）
      if (!entry[route]) entry[route] = { candidate: hit, rank: i + 1 }
      entries.set(hit.source, entry)
    })
  }
  collect(vectorHits, 'vector')
  collect(keywordHits, 'keyword')

  const fused: Array<{ candidate: FusionCandidate; fusedScore: number }> = []
  for (const entry of entries.values()) {
    let fusedScore = 0
    if (entry.vector) fusedScore += 1 / (RRF_K + entry.vector.rank)
    if (entry.keyword) fusedScore += 1 / (RRF_K + entry.keyword.rank)
    fused.push({
      fusedScore,
      candidate: {
        ...(entry.vector?.candidate ?? entry.keyword?.candidate),
        snippet:
          entry.vector?.candidate.snippet ??
          entry.keyword?.candidate.snippet ??
          '',
        matchedTerms: entry.keyword?.candidate.matchedTerms ?? [],
      },
    })
  }

  return fused
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, topK)
    .map((item) => ({
      ...item.candidate,
      score: Math.round(item.fusedScore * 1e6) / 1e6,
    }))
}
