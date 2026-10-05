/**
 * 高亮 HTML 按行拆分：跨多行的 token span 在行尾闭合、下一行重开，
 * 保证每行是完整 HTML（行号渲染与折叠的前提）。纯函数。
 *
 * 算法源自 toimc-sub2api CodeWindow 的 splitHighlightedLines，并修正其
 * 行首闭合标签未抵消跨行栈的问题（原实现行内 `</span>` 只 pop 本行新开
 * 的栈，闭合的是上一行遗留 span 时会多补一个闭合标签）。
 */

/** 匹配 span 开/闭标签（\b 排除 <spanx> 之类的误命中） */
const SPAN_TAG_RE = /<span\b[^>]*>|<\/span>/g

export function splitHighlightedLines(html: string): string[] {
  // 跨行未闭合 span 的开标签原样记录，供下一行重开
  let open: string[] = []
  return html.split('\n').map((line) => {
    const prefix = open.join('')
    // 本行新开、尚未闭合的 span
    const stack: string[] = []
    for (const tag of line.match(SPAN_TAG_RE) ?? []) {
      if (tag === '</span>') {
        // 优先闭合本行新开的；其次抵消上一行遗留的跨行 span
        if (stack.length > 0) stack.pop()
        else open.pop()
      } else {
        stack.push(tag)
      }
    }
    // 行尾补齐所有仍开启的 span（遗留 + 本行新开），使本行成为完整 HTML
    const suffix = '</span>'.repeat(open.length + stack.length)
    open = open.concat(stack)
    return prefix + line + suffix
  })
}
