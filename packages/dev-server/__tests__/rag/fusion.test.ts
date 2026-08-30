import { describe, expect, it } from 'vitest'
import type { FusionCandidate } from '../../src/rag/fusion'
import { rrfFuse } from '../../src/rag/fusion'

function hit(
  source: string,
  score: number,
  extra: Partial<FusionCandidate> = {},
): FusionCandidate {
  return {
    source,
    title: source,
    snippet: `snippet of ${source}`,
    score,
    matchedTerms: [],
    ...extra,
  }
}

describe('rrfFuse（手算字面量，k=60）', () => {
  it('双路命中同一来源时融合分领先，单路来源按名次排后', () => {
    // 向量路：A(rank1)=1/61、B(rank2)=1/62；关键词路：B(rank1)=1/61、C(rank2)=1/62
    // 期望：B = 1/62+1/61 ≈ 0.032523 最高；A = 1/61 ≈ 0.016393 次之；C = 1/62 ≈ 0.016129 最低
    const vectorHits = [hit('a.md', 0.91), hit('b.md', 0.85)]
    const keywordHits = [
      hit('b.md', 6.2, { matchedTerms: ['气泡'] }),
      hit('c.md', 4.1),
    ]
    const fused = rrfFuse(vectorHits, keywordHits, 3)
    expect(fused.map((f) => f.source)).toEqual(['b.md', 'a.md', 'c.md'])
    expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61, 6)
    expect(fused[1].score).toBeCloseTo(1 / 61, 6)
    expect(fused[2].score).toBeCloseTo(1 / 62, 6)
  })

  it('双路同来源合并：片段取向量路（块级更精确），matchedTerms 取关键词路', () => {
    const vectorHits = [hit('b.md', 0.9, { snippet: '向量块片段' })]
    const keywordHits = [
      hit('b.md', 5, {
        snippet: '关键词命中片段',
        matchedTerms: ['气泡', '圆角'],
      }),
    ]
    const [fused] = rrfFuse(vectorHits, keywordHits, 5)
    expect(fused.snippet).toBe('向量块片段')
    expect(fused.matchedTerms).toEqual(['气泡', '圆角'])
  })

  it('topK 截断与空输入', () => {
    const list = [hit('a.md', 1), hit('b.md', 2), hit('c.md', 3)]
    expect(rrfFuse(list, [], 2)).toHaveLength(2)
    expect(rrfFuse([], [], 5)).toEqual([])
    // 单路输入原样保序输出（rank 递增 → 融合分递减）
    expect(rrfFuse([], list, 5).map((f) => f.source)).toEqual([
      'a.md',
      'b.md',
      'c.md',
    ])
  })
})
