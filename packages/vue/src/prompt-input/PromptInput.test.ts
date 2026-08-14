import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptInput from './PromptInput.vue'

describe('PromptInput', () => {
  it('渲染 disclaimer 默认文案', () => {
    const w = mount(PromptInput)
    expect(w.find('.ai-chat-prompt-input__disclaimer').exists()).toBe(true)
    expect(w.text()).toContain('AI Chat UI')
  })

  it('disclaimer slot 可覆盖', () => {
    const w = mount(PromptInput, {
      slots: { disclaimer: '自定义提示' },
    })
    expect(w.text()).toContain('自定义提示')
  })
})
