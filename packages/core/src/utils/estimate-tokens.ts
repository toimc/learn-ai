// 轻量 token 估算：CJK 1:1，其余 4 字符 ≈ 1 token。真实 usage 可得时优先用真实值（见 useChat 回填）。
const CJK_RE = /[⺀-鿿豈-﫿＀-￯]/g

export function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = text.match(CJK_RE)?.length ?? 0
  const rest = text.length - cjk
  return Math.ceil(cjk + rest / 4)
}
