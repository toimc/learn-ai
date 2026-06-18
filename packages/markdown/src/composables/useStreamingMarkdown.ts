import { shallowRef } from 'vue'
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
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(renderNow)
  }

  const flush = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    renderNow()
  }

  return { html, setContent, flush }
}
