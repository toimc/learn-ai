/**
 * LLM 畸形公式预处理（markdown-it 渲染前）：
 *  1. 多行 $$ 块被段落吸收撕碎 → 重新聚合为前后空行隔离的完整块（math_block 整块消费）
 *  2. 公式行下的 --- / === 被 Setext 误判为标题 → 块隔离后随公式体整块进入 math_block
 *  3. 行内 $ 与货币金额误判 → 上下文启发式排除（数字紧邻 + CJK/行尾等货币边界，转义为 \$）
 *  4. 未闭合 $$ 的容错（所在段落末尾补齐闭合符，保证渲染不吞后续正文）
 *
 * 纯函数零依赖。与 extractCompleteMarkdown 职责区分：那是流式完整性提取（截断未闭合尾巴），
 * 这是公式容错；管线串联顺序 = extractCompleteMarkdown → guardMathBlocks → markdown-it。
 * 代码 fence（```/~~~）内的内容一律不动；引用/列表上下文中的多行公式不做块隔离（交由行内规则）。
 */

const FENCE_RE = /^(?:`{3,}|~{3,})/
/** CJK 统一表意文字 + CJK 标点 + 全角符号（含全角逗号/句号/括号等），用 unicode 转义避免全角空白字面量 */
const CJK_RE = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/
/** 引用/列表起始标记：这些上下文的懒延续不做块隔离，避免破坏宿主结构 */
const LAZY_CONTEXT_RE = /^\s*(?:>|[-*+]\s|\d+[.)]\s)/

interface MathOpener {
  /** `$$` 前的文字（行尾起块时需拆分为独立段落） */
  prefix: string
  /** `$$` 后剩余内容（拼回规范化的块首行） */
  suffix: string
}

/** 找出一行内所有未被反斜杠转义的 `$$` 起始位置 */
function unescapedDollar2(line: string): number[] {
  const hits: number[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '$' && line[i + 1] === '$') {
      hits.push(i)
      i += 2
      continue
    }
    i++
  }
  return hits
}

/**
 * 识别多行块的起始行：整行仅含 1 个未转义 `$$`，且为
 * 「行首起块（≤3 空格缩进）」或「行尾起块（`$$` 前有正文）」两种形态。
 * 单行自闭合（≥2 个 `$$`）与行中混排不处理（texmath 已正确处理）。
 */
function findOpener(line: string): MathOpener | null {
  const hits = unescapedDollar2(line)
  if (hits.length !== 1) return null
  const at = hits[0]!
  const before = line.slice(0, at)
  const after = line.slice(at + 2)
  if (/^[ \t]{0,3}$/.test(before)) return { prefix: '', suffix: after }
  if (before.trim() !== '' && /^\s*$/.test(after)) {
    // 引用/标题/表格/列表行内的行尾 $$ 不视为块起始
    if (
      LAZY_CONTEXT_RE.test(before) ||
      /^\s*#/.test(before) ||
      /^\s*\|/.test(before)
    ) {
      return null
    }
    return { prefix: before, suffix: '' }
  }
  return null
}

/** 从 from 起找闭合行（首个含未转义 `$$` 的行）；不跨代码 fence */
function findCloserLine(lines: string[], from: number): number {
  for (let j = from; j < lines.length; j++) {
    const line = lines[j]!
    if (FENCE_RE.test(line)) return -1
    if (unescapedDollar2(line).length > 0) return j
  }
  return -1
}

/** 块起始行上方是否处于引用/列表的懒延续上下文（向上扫到首个空行） */
function inLazyContext(lines: string[], openerIdx: number): boolean {
  for (let k = openerIdx - 1; k >= 0; k--) {
    const line = lines[k]!
    if (line.trim() === '') return false
    if (LAZY_CONTEXT_RE.test(line)) return true
  }
  return false
}

/** 输出行缓冲末尾是否为 fence 闭合行（fence 后的块无需再插空行） */
function endsWithFence(out: string[]): boolean {
  return out.length > 0 && FENCE_RE.test(out[out.length - 1]!)
}

interface BlockEmit {
  /** 前缀正文行（行尾起块时） */
  prefix: string
  /** 块首行 `$$` 之后的同行内容 */
  suffix: string
  /** 公式体行（含闭合行上 `$$` 之前的尾部内容） */
  body: string[]
  /** 闭合行上 `$$` 之后的同行文字（防 block 规则静默丢弃，拆出为独立段落） */
  tail: string
}

function pushBlock(
  out: string[],
  ranges: Array<[number, number]>,
  parts: BlockEmit,
): void {
  if (parts.prefix.trim() !== '') {
    out.push(parts.prefix.trimEnd())
    out.push('')
  } else if (
    out.length > 0 &&
    out[out.length - 1]!.trim() !== '' &&
    !endsWithFence(out)
  ) {
    out.push('')
  }
  const start = out.length
  out.push('$$' + parts.suffix)
  out.push(...parts.body)
  out.push('$$')
  ranges.push([start, out.length])
  if (parts.tail.trim() !== '') {
    out.push('')
    out.push(parts.tail.trim())
  }
}

/** 金额后是否为货币边界：行尾 / 紧邻 CJK 或全角标点 / 空格后跟 CJK */
function isCurrencyAfter(line: string, end: number): boolean {
  if (end >= line.length) return true
  if (CJK_RE.test(line[end]!)) return true
  const spaces = /^ +/.exec(line.slice(end))
  if (spaces) {
    const next = end + spaces[0].length
    if (next < line.length && CJK_RE.test(line[next]!)) return true
  }
  return false
}

/** 把疑似货币金额的 `$` 转义为 `\$`（texmath 的 pre/post 只防数字紧邻，防不住紧凑中文场景） */
function escapeCurrency(line: string): string {
  const re = /\$(\d[\d,]*(?:\.\d+)?)/g
  const edits: number[] = [] // 需要前插反斜杠的 $ 位置
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const at = m.index
    const prev = at > 0 ? line[at - 1] : ''
    // 已转义 / 紧跟其他 $（$$ 定界符）/ 前邻数字（texmath pre 已拒绝）均跳过
    if (prev === '\\' || prev === '$') continue
    if (prev >= '0' && prev <= '9') continue
    if (isCurrencyAfter(line, at + m[0].length)) edits.push(at)
  }
  if (edits.length === 0) return line
  let res = ''
  let last = 0
  for (const at of edits) {
    res += `${line.slice(last, at)}\\$`
    last = at + 1 // 只替换 $ 本身，数字留给后续切片
  }
  return res + line.slice(last)
}

export function guardMathBlocks(md: string): string {
  if (!md) return md

  const lines = md.split('\n')
  const out: string[] = []
  const mathRanges: Array<[number, number]> = []
  let fenceMark = ''
  let fenceLen = 0

  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const fenceMatch = /^(?:`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const mark = fenceMatch[0][0]!
      const len = fenceMatch[0].length
      if (!fenceMark) {
        fenceMark = mark
        fenceLen = len
      } else if (mark === fenceMark && len >= fenceLen) {
        fenceMark = ''
        fenceLen = 0
      }
      out.push(line)
      i++
      continue
    }
    if (fenceMark) {
      out.push(line)
      i++
      continue
    }

    const opener = findOpener(line)
    if (!opener || inLazyContext(lines, i)) {
      out.push(line)
      i++
      continue
    }

    const closerIdx = findCloserLine(lines, i + 1)
    if (closerIdx >= 0) {
      const closer = lines[closerIdx]!
      const closerAt = unescapedDollar2(closer)[0]!
      const body = lines.slice(i + 1, closerIdx)
      const head = closer.slice(0, closerAt)
      if (head.trim() !== '') body.push(head)
      pushBlock(out, mathRanges, {
        prefix: opener.prefix,
        suffix: opener.suffix,
        body,
        tail: closer.slice(closerAt + 2),
      })
      i = closerIdx + 1
      continue
    }

    // 未闭合：在所在段落末尾（下一个空行 / fence / EOF 前）补齐闭合符；
    // 孤立 `$$`（无公式体也无同行内容）保留字面量不动
    const body: string[] = []
    let k = i + 1
    while (
      k < lines.length &&
      lines[k]!.trim() !== '' &&
      !FENCE_RE.test(lines[k]!)
    ) {
      body.push(lines[k]!)
      k++
    }
    if (body.length === 0 && opener.suffix.trim() === '') {
      out.push(line)
      i++
      continue
    }
    pushBlock(out, mathRanges, {
      prefix: opener.prefix,
      suffix: opener.suffix,
      body,
      tail: '',
    })
    i = k
  }

  // 货币转义：跳过公式块与代码 fence，只处理正文行
  const inMath = (idx: number): boolean =>
    mathRanges.some(([s, e]) => idx >= s && idx < e)
  let mark = ''
  let len = 0
  return out
    .map((line, idx) => {
      const fence = /^(?:`{3,}|~{3,})/.exec(line)
      if (fence) {
        const fm = fence[0][0]!
        const fl = fence[0].length
        if (!mark) {
          mark = fm
          len = fl
        } else if (fm === mark && fl >= len) {
          mark = ''
          len = 0
        }
        return line
      }
      if (mark || inMath(idx)) return line
      return escapeCurrency(line)
    })
    .join('\n')
}
