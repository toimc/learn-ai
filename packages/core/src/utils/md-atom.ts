// markdown 原子化切分（纯函数）：frontmatter / $$ 块公式 / 原生 HTML 块 / 代码围栏
// 这些不可逐字编辑的结构整块直通（editable: false），其余为 text。
// 边界识别逻辑直译自 phd-battle-map md-atom.ts（\n 行体系；CRLF 的 \r 留在行内容里随字节保真）。
// 红线：joinAtoms(splitAtoms(md)) === md 字节级往返保真——atom.raw 用原文偏移切片，
// 相邻原子各自带上分界换行，首尾相接无重叠无缝隙。

export interface MdAtom {
  /** frontmatter / math-block（$$..$$）/ html-block / fence（```..```）/ text */
  type: 'frontmatter' | 'math-block' | 'html-block' | 'fence' | 'text'
  /** 原文逐字节片段 */
  raw: string
  /** false = 结构块，编辑器场景整块直通不可逐字编辑 */
  editable: boolean
}

// 行首（trim 后）以这些前缀开头的行进入 HTML 块：details 折叠块 / div 包图 /
// 手写 table / figure / center / span 锚点行 / img / HTML 注释。
// <p 开头不进原子——段落是可编辑产出，须走富文本解析。
const HTML_PREFIXES = [
  '<details',
  '<div',
  '<table',
  '<figure',
  '<center',
  '<span',
  '<img',
  '<!--',
]
const PAIRED_TAGS = ['details', 'div', 'table', 'figure', 'center']

const trimStart = (s: string) => s.replace(/^[ \t]+/, '')
const isFenceLine = (s: string) => /^\s*(?:```|~~~)/.test(s)

function lineKind(line: string): 'html' | 'mathBlock' | 'md' {
  const t = trimStart(line)
  if (t.startsWith('$$')) return 'mathBlock'
  if (HTML_PREFIXES.some((p) => t.toLowerCase().startsWith(p))) return 'html'
  return 'md'
}

// $$...$$ 块：从含 $$ 的行起，到再次出现（trim 后）以 $$ 结尾的行止（同行闭合也算）
function mathBlockEnd(lines: string[], start: number): number {
  const first = trimStart(lines[start])
  if (first.endsWith('$$') && first.length > 4) return start // 单行 $$x$$
  for (let i = start + 1; i < lines.length; i++) {
    if (trimStart(lines[i]).endsWith('$$')) return i
  }
  return start // 未闭合（写错）：退化为单行，fail-closed 不吞后续
}

// HTML 块：配对标签（details/div/...）扫到闭合行止；
// void/单行标签（img/span/注释）吃掉后续连续以 < 开头的行
function htmlBlockEnd(lines: string[], start: number): number {
  const open =
    /^<([a-zA-Z0-9]+)/.exec(trimStart(lines[start]))?.[1]?.toLowerCase() ?? ''
  if (PAIRED_TAGS.includes(open)) {
    const close = `</${open}`
    for (let i = start; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(close)) return i // 同行开闭 / 后续行闭合
    }
    return start // 未闭合：单行
  }
  let end = start
  for (let i = start + 1; i < lines.length; i++) {
    if (trimStart(lines[i]).startsWith('<')) end = i
    else break
  }
  if (open === '!--') {
    // 注释以 --> 结束，可能跨行
    const stop = end > start ? end : lines.length - 1
    for (let i = start; i <= stop; i++) {
      if (lines[i].includes('-->')) {
        end = i
        break
      }
    }
  }
  return end
}

export function splitAtoms(md: string): MdAtom[] {
  if (md === '') return []

  const lines = md.split('\n')
  const phantom = md.endsWith('\n') ? 1 : 0 // 末尾 '' 元素 = 收尾换行的余数，非真实行
  const realCount = lines.length - phantom

  // 每行起始字节偏移（split('\n') 下行内容自带 \r，CRLF 随内容保真）
  const starts = new Array<number>(lines.length)
  let offset = 0
  for (let k = 0; k < lines.length; k++) {
    starts[k] = offset
    offset += lines[k].length + 1
  }
  // 行 k 的原子末端 = 下一行起点（吞掉本行分界换行）；最后一行钳到 md.length
  const nextStart = (k: number): number =>
    k + 1 < lines.length ? starts[k + 1] : md.length
  const rawOf = (i: number, j: number): string =>
    md.slice(starts[i], nextStart(j))

  const atoms: MdAtom[] = []
  let i = 0

  // frontmatter：字节 0 起的 --- 块（未闭合则不当 frontmatter，按普通文本走）
  if (/^---[ \t]*$/.test(lines[0] ?? '')) {
    let close = -1
    for (let j = 1; j < lines.length; j++) {
      if (/^---[ \t]*$/.test(lines[j])) {
        close = j
        break
      }
    }
    if (close > 0) {
      atoms.push({ type: 'frontmatter', raw: rawOf(0, close), editable: false })
      i = close + 1
    }
  }

  let textStart = -1
  const flushText = (endExclusive: number): void => {
    if (textStart >= 0 && textStart < endExclusive) {
      atoms.push({
        type: 'text',
        raw: rawOf(textStart, endExclusive - 1),
        editable: true,
      })
      textStart = -1
    }
  }

  while (i < realCount) {
    const line = lines[i]
    if (isFenceLine(line)) {
      // 围栏内所有行（含空行、$$、< 开头行）都是 fence 内容；未闭合兜底吞到文末
      flushText(i)
      let close = i + 1
      while (close < realCount && !isFenceLine(lines[close])) close++
      atoms.push({ type: 'fence', raw: rawOf(i, close), editable: false })
      i = close + 1
      continue
    }
    const kind = lineKind(line)
    if (kind === 'mathBlock') {
      flushText(i)
      const end = mathBlockEnd(lines, i)
      atoms.push({ type: 'math-block', raw: rawOf(i, end), editable: false })
      i = end + 1
      continue
    }
    if (kind === 'html') {
      flushText(i)
      const end = htmlBlockEnd(lines, i)
      atoms.push({ type: 'html-block', raw: rawOf(i, end), editable: false })
      i = end + 1
      continue
    }
    if (textStart < 0) textStart = i
    i++
  }
  flushText(realCount)

  return atoms
}

export function joinAtoms(atoms: MdAtom[]): string {
  return atoms.map((a) => a.raw).join('')
}
