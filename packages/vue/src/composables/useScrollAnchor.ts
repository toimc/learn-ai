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
  let mutationObserver: MutationObserver | null = null
  let lastContentHeight = 0
  let growthScheduled = false

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

  function handleGrowth() {
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
  }

  /** rAF 合并：流式期间 MO/RO 高频回调每帧只做一次 scrollHeight 对比 */
  function scheduleGrowthCheck() {
    if (growthScheduled) return
    growthScheduled = true
    requestAnimationFrame(() => {
      growthScheduled = false
      handleGrowth()
    })
  }

  function bindContainer(el: HTMLElement | null) {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = null
    }
    container = el
    if (!container) return

    unreadCount.value = 0
    // 以绑定瞬间的内容高度为基线，避免首个回调把初始高度误判为新增
    lastContentHeight = container.scrollHeight

    container.addEventListener('scroll', checkBottom, { passive: true })

    // 容器自身尺寸变化（窗口缩放等）
    observer = new ResizeObserver(scheduleGrowthCheck)
    observer.observe(container)
    // 内容变化兜底：overflow 定高容器的内容增高不改变容器自身尺寸，浏览器不派发
    // 容器 RO——必须监听子树节点/文本变化（修复生产中 unreadCount 永不增长）
    mutationObserver = new MutationObserver(scheduleGrowthCheck)
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  return { isAtBottom, unreadCount, scrollToBottom, bindContainer }
}
