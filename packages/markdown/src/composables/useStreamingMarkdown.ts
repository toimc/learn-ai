import { onScopeDispose, shallowRef } from 'vue'
import DOMPurify from 'dompurify'
import { useMarkdownIt } from './useMarkdownIt'
import { extractCompleteMarkdown } from '../utils/extractCompleteMarkdown'

export function useStreamingMarkdown() {
  const md = useMarkdownIt()
  const html = shallowRef<string>('')

  let rafId = 0
  let pending = ''

  const renderNow = () => {
    const safe = extractCompleteMarkdown(pending)
    const raw = md.render(safe)
    html.value = DOMPurify.sanitize(raw, {
      ADD_TAGS: ['svg', 'path', 'foreignObject'],
      ADD_ATTR: ['viewBox', 'd', 'fill', 'stroke', 'xmlns'],
    })
  }

  const setContent = (content: string) => {
    pending = content
    if (typeof window === 'undefined') return // SSR 构建期无 requestAnimationFrame，跳过（客户端 hydrate 后再渲染）
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(renderNow)
  }

  const flush = () => {
    if (typeof window === 'undefined') return // SSR 构建期 DOMPurify 不可用，跳过
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    renderNow()
  }

  onScopeDispose(() => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  })

  return { html, setContent, flush }
}
