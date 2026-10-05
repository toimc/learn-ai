import { ref, type Ref } from 'vue'

export interface ScrollAnchorContext {
  isAtBottom: Ref<boolean>
  /** 离底期间容器内容新增导致的未读计数（贴底时恒为 0） */
  unreadCount: Ref<number>
  scrollToBottom: () => void
  bindContainer: (el: HTMLElement | null) => void
}

export function useScrollAnchor(threshold = 50): ScrollAnchorContext {
  const isAtBottom = ref(true)
  const unreadCount = ref(0)
  let container: HTMLElement | null = null
  let observer: ResizeObserver | null = null
  let lastContentHeight = 0

  function checkBottom() {
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    isAtBottom.value = scrollHeight - scrollTop - clientHeight < threshold
    if (isAtBottom.value) unreadCount.value = 0
  }

  function scrollToBottom() {
    unreadCount.value = 0
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

    unreadCount.value = 0
    // 以绑定瞬间的内容高度为基线，避免首个回调把初始高度误判为新增
    lastContentHeight = container.scrollHeight

    container.addEventListener('scroll', checkBottom, { passive: true })

    observer = new ResizeObserver(() => {
      if (!container) return
      const contentHeight = container.scrollHeight
      const grew = contentHeight > lastContentHeight
      lastContentHeight = contentHeight
      if (isAtBottom.value) {
        scrollToBottom()
      } else if (grew) {
        // 「新消息」= 内容高度增加：无法区分新增与文本替换，语义局限见文档
        unreadCount.value++
      }
    })
    observer.observe(container)
  }

  return { isAtBottom, unreadCount, scrollToBottom, bindContainer }
}
