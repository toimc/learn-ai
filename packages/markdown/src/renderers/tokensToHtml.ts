/**
 * ThemedToken[] → 高亮 HTML 字符串（FR-2.3）
 *
 * 设计要点：
 * - 仅依赖 shiki 的 `ThemedToken` 类型，不耦合具体高亮器实例。
 * - 支持 Shiki 三种着色来源：
 *   1. `color` / `bgColor` / `fontStyle`（单主题）
 *   2. `htmlStyle`（双主题经 `flatTokenVariants` 产出的 CSS 变量，FR-2.7）
 *   3. `htmlAttrs.style`（transformer 注入的内联样式）
 * - 严格转义 token 文本的 `&` `<` `>`，避免注入。
 * - 无任何样式的 token 仍渲染为裸 `<span>`，保持结构完整便于后续选择器命中。
 */
import type { ThemedToken } from 'shiki/core'

/** 转义 HTML 特殊字符（与 Shiki 官方 tokensToHast 一致，仅 & < >） */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Shiki FontStyle 位掩码 → CSS font-style 值 */
function fontStyleToCss(fontStyle: number | undefined): string | null {
  if (fontStyle === undefined || fontStyle === 0) return null
  // 1=Italic 2=Bold 4=Underline（位掩码可组合）
  const parts: string[] = []
  if (fontStyle & 1) parts.push('italic')
  if (fontStyle & 2) parts.push('bold')
  if (fontStyle & 4) parts.push('underline')
  return parts.length ? parts.join(' ') : null
}

/** 把一个 token 折叠为 CSS 声明对象（key:value），顺序稳定 */
function tokenToStyleMap(token: ThemedToken): Record<string, string> {
  const style: Record<string, string> = {}

  // 1) htmlStyle 优先级最高（双主题 CSS 变量 / 或显式覆盖）
  if (token.htmlStyle) {
    for (const [k, v] of Object.entries(token.htmlStyle)) {
      if (v != null && v !== '') style[k] = v
    }
    return style // htmlStyle 存在时 Shiki 已合并 color/变量，直接用
  }

  // 2) 单主题字段：color / bgColor / fontStyle
  if (token.color) style['color'] = token.color
  if (token.bgColor) style['background-color'] = token.bgColor
  const fs = fontStyleToCss(token.fontStyle)
  if (fs) style['font-style'] = fs

  return style
}

/** style 对象 → 内联 style 字符串（不含外层引号） */
function styleMapToString(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

/**
 * 把 `ThemedToken[]` 渲染为高亮 HTML（一连串 `<span>`）。
 *
 * 不包含外层 `<pre><code>`，仅是 token 级 span，便于流式增量替换。
 * 空数组返回空字符串。
 */
export function tokensToHtml(tokens: ThemedToken[]): string {
  if (tokens.length === 0) return ''
  return tokens
    .map((token) => {
      const text = escapeHtml(token.content)
      // htmlAttrs.style（transformer 注入）优先于字段派生
      const styleStr = token.htmlAttrs?.style
        ? token.htmlAttrs.style
        : styleMapToString(tokenToStyleMap(token))
      return styleStr
        ? `<span style="${styleStr}">${text}</span>`
        : `<span>${text}</span>`
    })
    .join('')
}
