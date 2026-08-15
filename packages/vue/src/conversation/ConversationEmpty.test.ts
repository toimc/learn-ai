import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConversationEmpty from './ConversationEmpty.vue'
import { setAiChatLocale } from '../locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('ConversationEmpty i18n', () => {
  it('未传 props：渲染中文字典文案', () => {
    const w = mount(ConversationEmpty)
    expect(w.get('.ai-chat-conversation-empty__title').text()).toBe(
      '有什么可以帮你的？',
    )
    expect(w.get('.ai-chat-conversation-empty__desc').text()).toBe(
      '选择一个话题开始，或直接输入你的问题',
    )
  })

  it('传 props：props 优先', () => {
    const w = mount(ConversationEmpty, { props: { title: '自定义标题' } })
    expect(w.get('.ai-chat-conversation-empty__title').text()).toBe(
      '自定义标题',
    )
  })

  it('切换英文：文案响应式更新', async () => {
    const w = mount(ConversationEmpty)
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.get('.ai-chat-conversation-empty__title').text()).toBe(
      'How can I help you?',
    )
  })
})
