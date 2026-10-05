/**
 * 输入内联建议纯逻辑：光标触发词解析 + label 过滤。
 * 受控设计——不依赖 prompt-input 上下文，宿主监听输入框光标后把 text/caret 传入即可。
 */

export interface SuggestionItem {
  key: string
  label: string
  description?: string
  /** 二级建议（暂只渲染一级，字段透传保留扩展位） */
  children?: SuggestionItem[]
}

export interface SuggestionTrigger {
  /** 触发字符，如 '/' 或 '@'；须位于词首（文本首/行首/空白之后）才激活 */
  char: string
  items: SuggestionItem[]
}

export interface ParsedSuggestion {
  /** 命中的触发器（传入数组的同一引用，宿主可据其取 items） */
  trigger: SuggestionTrigger
  /** 触发符之后到光标的已输入过滤串 */
  query: string
  /** 触发词（触发符 + query）在原文中的区间，选中后整体替换 */
  replaceRange: [number, number]
}

const WHITESPACE = /\s/

/**
 * 解析光标处激活的触发词与已输入过滤串；未激活返回 null。
 *
 * 从光标位置向前扫描：遇空白即失效（触发词内不允许空白）；遇到触发符且其前
 * 是词首边界（文本首或空白）则激活。光标停在触发词中间时，query 与 replaceRange
 * 只覆盖触发符到光标的区段，光标后的字符保持原样。
 */
export function parseSuggestion(
  text: string,
  caret: number,
  triggers: SuggestionTrigger[],
): ParsedSuggestion | null {
  if (triggers.length === 0) return null
  const pos = Math.min(Math.max(Math.trunc(caret) || 0, 0), text.length)
  let i = pos
  while (i > 0) {
    if (WHITESPACE.test(text[i - 1])) return null
    const trigger = triggers.find(
      (t) => t.char !== '' && text.endsWith(t.char, i),
    )
    if (trigger) {
      const start = i - trigger.char.length
      if (start === 0 || WHITESPACE.test(text[start - 1])) {
        return {
          trigger,
          query: text.slice(i, pos),
          replaceRange: [start, pos],
        }
      }
      return null
    }
    i -= 1
  }
  return null
}

/**
 * label 前缀 + 包含双策略过滤（大小写不敏感）：前缀命中排前、包含命中排后，
 * 各组内保持原序；空 query 原样返回全部。children 不参与过滤、原样透传。
 */
export function filterSuggestions(
  items: SuggestionItem[],
  query: string,
): SuggestionItem[] {
  const q = query.toLowerCase()
  if (q === '') return items.slice()
  const prefixed: SuggestionItem[] = []
  const contained: SuggestionItem[] = []
  for (const item of items) {
    const label = item.label.toLowerCase()
    if (label.startsWith(q)) prefixed.push(item)
    else if (label.includes(q)) contained.push(item)
  }
  return [...prefixed, ...contained]
}
