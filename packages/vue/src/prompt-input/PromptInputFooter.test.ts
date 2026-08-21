import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptInputFooter from './PromptInputFooter.vue'

describe('PromptInputFooter', () => {
  it('tools 与 hint 具名插槽分列渲染', () => {
    const w = mount(PromptInputFooter, {
      slots: {
        tools: '<div class="mark-tools">T</div>',
        hint: '<div class="mark-hint">H</div>',
      },
    })
    expect(
      w.find('.ai-chat-prompt-input-footer__tools .mark-tools').exists(),
    ).toBe(true)
    expect(
      w.find('.ai-chat-prompt-input-footer__hint .mark-hint').exists(),
    ).toBe(true)
  })
})
