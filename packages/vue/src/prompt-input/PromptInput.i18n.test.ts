import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import PromptInput from './PromptInput.vue'
import PromptInputTextarea from './PromptInputTextarea.vue'
import { setAiChatLocale } from '../locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('PromptInput i18n', () => {
  it('未传 placeholder：disclaimer 渲染中文字典文案', () => {
    const w = mount(PromptInput)
    expect(w.get('.ai-chat-prompt-input__disclaimer').text()).toContain(
      'AI Chat UI 可能会产生不准确的信息',
    )
  })

  it('切换英文：disclaimer 响应式更新', async () => {
    const w = mount(PromptInput)
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.get('.ai-chat-prompt-input__disclaimer').text()).toContain(
      'may produce inaccurate information',
    )
  })

  it('provide 的 placeholder 回退字典（Textarea 消费）', () => {
    const w = mount(PromptInput, {
      slots: { default: () => h(PromptInputTextarea) },
    })
    expect(w.find('textarea').attributes('placeholder')).toBe(
      '给 AI Chat UI 发送消息...',
    )
  })

  it('传 placeholder：props 优先', () => {
    const w = mount(PromptInput, {
      props: { placeholder: '自定义' },
      slots: { default: () => h(PromptInputTextarea) },
    })
    expect(w.find('textarea').attributes('placeholder')).toBe('自定义')
  })
})
