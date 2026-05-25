import { ref, type Ref } from 'vue'

export interface ScrollAnchorContext {
  isAtBottom: Ref<boolean>
  scrollToBottom: () => void
  bindContainer: (el: HTMLElement | null) => void
}

export function useScrollAnchor(threshold = 50): ScrollAnchorContext {
  const isAtBottom = ref(true)
  let container: HTMLElement | null = null
  let observer: ResizeObserver | null = null

  function checkBottom() {
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    isAtBottom.value = scrollHeight - scrollTop - clientHeight < threshold
  }

  function scrollToBottom() {
    if (!container) return
    requestAnimationFrame(() => {
      container!.scrollTop = container!.scrollHeight
    })
  }

  function bindContainer(el: HTMLElement | null) {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    container = el
    if (!container) return

    container.addEventListener('scroll', checkBottom, { passive: true })

    observer = new ResizeObserver(() => {
      if (isAtBottom.value) {
        scrollToBottom()
      }
    })
    observer.observe(container)
  }

  return { isAtBottom, scrollToBottom, bindContainer }
}
