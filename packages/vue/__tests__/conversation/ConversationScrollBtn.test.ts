import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { setAiChatLocale } from '../../src/locales'
import type { ScrollAnchorContext } from '../../src/composables/useScrollAnchor'
import ConversationScrollBtn from '../../src/conversation/ConversationScrollBtn.vue'

// i18n 模块级单例：显式固定 locale，避免 jsdom navigator.language 泄漏为 en-US
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeAnchor(overrides: Partial<ScrollAnchorContext> = {}) {
  const anchor: ScrollAnchorContext = {
    isAtBottom: ref(true),
    unreadCount: ref(0),
    scrollToBottom: () => {},
    bindContainer: () => {},
    ...overrides,
  }
  return anchor
}

function mountBtn(
  anchor: ScrollAnchorContext | undefined,
  props: { badge?: number } = {},
) {
  return mount(ConversationScrollBtn, {
    props,
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

describe('ConversationScrollBtn 未读角标', () => {
  it('正常：inject 的 unreadCount > 0 时渲染角标数字', async () => {
    const anchor = makeAnchor()
    anchor.isAtBottom.value = false
    anchor.unreadCount.value = 3
    const w = mountBtn(anchor)

    const badge = w.find('.ai-chat-scroll-btn__badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
  })

  it('边界：unreadCount 为 0 时不渲染角标', () => {
    const anchor = makeAnchor()
    anchor.isAtBottom.value = false
    const w = mountBtn(anchor)

    expect(w.find('.ai-chat-scroll-btn__badge').exists()).toBe(false)
  })

  it('正常：显式 badge prop 覆盖 inject 的 unreadCount', () => {
    const anchor = makeAnchor()
    anchor.isAtBottom.value = false
    anchor.unreadCount.value = 7
    const w = mountBtn(anchor, { badge: 2 })

    expect(w.get('.ai-chat-scroll-btn__badge').text()).toBe('2')
  })

  it('边界：badge prop 传 0 时覆盖 inject 非零值，不显示角标', () => {
    const anchor = makeAnchor()
    anchor.isAtBottom.value = false
    anchor.unreadCount.value = 5
    const w = mountBtn(anchor, { badge: 0 })

    expect(w.find('.ai-chat-scroll-btn__badge').exists()).toBe(false)
  })

  it('正常：角标 aria-label 使用 i18n 文案 conversation.scrollUnread', () => {
    const anchor = makeAnchor()
    anchor.isAtBottom.value = false
    anchor.unreadCount.value = 4
    const w = mountBtn(anchor)

    const label = w.get('.ai-chat-scroll-btn').attributes('aria-label')
    expect(label).toContain('4')
    expect(label).toContain('条新消息')
  })

  it('边界：无角标时不输出 aria-label', () => {
    const w = mountBtn(makeAnchor())
    expect(
      w.get('.ai-chat-scroll-btn').attributes('aria-label'),
    ).toBeUndefined()
  })
})
