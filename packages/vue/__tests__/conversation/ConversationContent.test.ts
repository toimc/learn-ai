import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type { ScrollAnchorContext } from '../../src/composables/useScrollAnchor'
import ConversationContent from '../../src/conversation/ConversationContent.vue'

function makeAnchor(isAtBottom = true) {
  const anchor: ScrollAnchorContext = {
    isAtBottom: ref(isAtBottom),
    scrollToBottom: vi.fn(),
    bindContainer: vi.fn(),
  }
  return anchor
}

function mountContent(
  anchor: ScrollAnchorContext | undefined,
  autoScroll?: boolean,
) {
  const provide: Record<string, unknown> = {}
  if (anchor) provide.scrollAnchor = anchor
  if (autoScroll !== undefined) provide.autoScroll = autoScroll

  return mount(ConversationContent, {
    slots: { default: '<p class="msg">初始消息</p>' },
    global: { provide },
  })
}

/** 向消息区追加子节点触发 MutationObserver，并等待观察回调执行 */
async function appendMessage(w: ReturnType<typeof mountContent>) {
  const container = w.get('.ai-chat-conversation-messages').element
  container.appendChild(document.createElement('p'))
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('ConversationContent 滚动容器与自动跟随', () => {
  it('正常：挂载后将滚动容器绑定到 anchor', () => {
    const anchor = makeAnchor()
    const w = mountContent(anchor)
    expect(anchor.bindContainer).toHaveBeenCalledOnce()
    expect(anchor.bindContainer).toHaveBeenCalledWith(
      w.get('.ai-chat-conversation-content').element,
    )
  })

  it('正常：autoScroll 默认开启，内容增长且在底部时自动滚底', async () => {
    const anchor = makeAnchor(true)
    const w = mountContent(anchor)
    await appendMessage(w)
    expect(anchor.scrollToBottom).toHaveBeenCalled()
  })

  it('边界：autoScroll=false 时内容增长不自动滚动', async () => {
    const anchor = makeAnchor(true)
    const w = mountContent(anchor, false)
    await appendMessage(w)
    expect(anchor.scrollToBottom).not.toHaveBeenCalled()
  })

  it('边界：autoScroll 开启但用户已上滑离开底部时不跟随', async () => {
    const anchor = makeAnchor(false)
    const w = mountContent(anchor, true)
    await appendMessage(w)
    expect(anchor.scrollToBottom).not.toHaveBeenCalled()
  })

  it('异常：未注入 anchor 时挂载不报错、不绑定容器', () => {
    const anchor = makeAnchor()
    const w = mountContent(undefined)
    expect(w.find('.ai-chat-conversation-content').exists()).toBe(true)
    expect(anchor.bindContainer).not.toHaveBeenCalled()
  })

  it('正常：卸载时断开 MutationObserver', () => {
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const anchor = makeAnchor()
    const w = mountContent(anchor)
    w.unmount()
    expect(disconnectSpy).toHaveBeenCalled()
  })
})
