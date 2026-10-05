import type { VueWrapper } from '@vue/test-utils'

/**
 * 双盲测试公用工具。
 * 约定：文档只承诺「折叠/收起/隐藏」，未规定 v-if 还是 v-show，
 * 两种实现（DOM 移除 / display:none）在这里都判为「不可见」。
 */
export function rendered(el: Element | null | undefined): boolean {
  if (!el) return false
  let node: Element | null = el
  while (node) {
    const html = node as HTMLElement
    if (html.style && html.style.display === 'none') return false
    if (node.getAttribute && node.getAttribute('hidden') !== null) return false
    node = node.parentElement
  }
  return true
}

/** 在组件子树与 document.body（Teleport 弹层落点）中查找文本精确等于 text 的最深层元素 */
export function findExactText(w: VueWrapper, text: string): Element | null {
  const roots: Element[] = [w.element]
  if (w.element.isConnected && document.body !== w.element)
    roots.push(document.body)
  for (const root of roots) {
    const matches = Array.from(root.querySelectorAll('*')).filter(
      (el) => (el.textContent ?? '').trim() === text,
    )
    // 祖先与后代同文本时（如按钮与其包裹 span）取最深层，保证点击命中实际监听元素
    if (matches.length > 0) {
      return matches.reduce((deepest, el) =>
        depth(el) > depth(deepest) ? el : deepest,
      )
    }
  }
  return null
}

function depth(el: Element): number {
  let d = 0
  let node: Element | null = el
  while (node.parentElement) {
    d += 1
    node = node.parentElement
  }
  return d
}

/** 同 findExactText，但找不到时抛错（用于必须存在的元素） */
export function requireExactText(w: VueWrapper, text: string): Element {
  const el = findExactText(w, text)
  if (!el) throw new Error(`文档元素未找到：${text}`)
  return el
}

/** 原生 click（可命中 Teleport 到 body 的元素；点击会冒泡到父级监听者） */
export function clickEl(el: Element): void {
  ;(el as HTMLElement).click()
}

/** 组件子树 + document.body（Teleport）合并文本，仅用于 toContain 类断言 */
export function domText(w: VueWrapper): string {
  const own = w.element.textContent ?? ''
  const body =
    w.element.isConnected && document.body.contains(w.element)
      ? (document.body.textContent ?? '')
      : ''
  return body || own
}

/** 压缩空白后比较（跨元素拼接的文本归一化） */
export function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
