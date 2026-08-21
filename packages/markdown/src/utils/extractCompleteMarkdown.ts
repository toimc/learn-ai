/**
 * 从流式 buffer 中提取「安全可渲染」的 Markdown：
 * 1. 若末尾处于未闭合的代码围栏（``` 或 ~~~）内，截到该围栏起始行之前。
 * 2. 若末尾处于未闭合的块级公式（$$）内（且不在代码块中），截到该 $$ 之前。
 *
 * 逐行扫描判断「是否在代码块内」，避免误伤代码块内部的 ``` / $$ 文本。
 * 支持外层 4+ 反引号包裹内层 3 反引号（同标记字符 + 至少相同长度才闭合）。
 */
export function extractCompleteMarkdown(buffer: string): string {
  if (!buffer) return ''

  const lines = buffer.split('\n')
  let inFence = false
  let fenceMark = '' // ` 或 ~
  let fenceLen = 0
  let cutToFenceLine = -1 // 未闭合围栏所在行号

  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = /^(?:`{3,}|~{3,})/.exec(lines[i])
    if (fenceMatch) {
      const mark = fenceMatch[0][0]
      const len = fenceMatch[0].length
      if (!inFence) {
        inFence = true
        fenceMark = mark
        fenceLen = len
        cutToFenceLine = i
      } else if (mark === fenceMark && len >= fenceLen) {
        inFence = false
        fenceMark = ''
        fenceLen = 0
        cutToFenceLine = -1
      }
    }
  }

  let safe = buffer
  if (inFence && cutToFenceLine >= 0) {
    // 截到未闭合围栏起始行之前
    safe = lines.slice(0, cutToFenceLine).join('\n')
  }

  // 在 safe（已剥除未闭合代码块）上检测未闭合 $$
  const dollarMatches = [...safe.matchAll(/\$\$/g)]
  if (dollarMatches.length % 2 === 1) {
    safe = safe.slice(0, dollarMatches[dollarMatches.length - 1]!.index!)
  }
  return safe
}
