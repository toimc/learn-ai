import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type { ScrollAnchorContext } from '../composables/useScrollAnchor'
import ConversationScrollBtn from './ConversationScrollBtn.vue'

function makeAnchor(overrides: Partial<ScrollAnchorContext> = {}) {
  const anchor: ScrollAnchorContext = {
    isAtBottom: ref(true),
    scrollToBottom: () => {},
    bindContainer: () => {},
    ...overrides,
  }
  return anchor
}

function mountBtn(anchor: ScrollAnchorContext | undefined) {
  return mount(ConversationScrollBtn, {
    global: { provide: { scrollAnchor: anchor } },
  })
}

describe('ConversationScrollBtn 回到底部按钮', () => {
  it('正常：注入 anchor 时渲染按钮', () => {
    const w = mountBtn(makeAnchor())
    expect(w.find('.ai-chat-scroll-btn').exists()).toBe(true)
  })

  it('异常：未注入 anchor 时不渲染任何内容', () => {
    const w = mountBtn(undefined)
    expect(w.find('.ai-chat-scroll-btn').exists()).toBe(false)
  })

  it('正常：isAtBottom=true 时按钮 visibility 隐藏', () => {
    const w = mountBtn(makeAnchor())
    expect(w.get('.ai-chat-scroll-btn').attributes('style')).toContain(
      'visibility: hidden',
    )
  })

  it('正常：isAtBottom=false 时按钮可见', async () => {
    const anchor = makeAnchor()
    const w = mountBtn(anchor)
    anchor.isAtBottom.value = false
    await nextTick()
    expect(w.get('.ai-chat-scroll-btn').attributes('style')).toContain(
      'visibility: visible',
    )
  })

  it('正常：点击调用 scrollToBottom', async () => {
    const scrollToBottom = vi.fn()
    const w = mountBtn(makeAnchor({ scrollToBottom }))
    await w.get('.ai-chat-scroll-btn').trigger('click')
    expect(scrollToBottom).toHaveBeenCalledOnce()
  })
})
