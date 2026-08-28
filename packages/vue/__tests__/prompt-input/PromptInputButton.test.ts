import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromptInputButton from '../../src/prompt-input/PromptInputButton.vue'
import PromptInputHeader from '../../src/prompt-input/PromptInputHeader.vue'

describe('PromptInputButton 工具按钮', () => {
  it('正常：渲染 button 并透传 slot', () => {
    const w = mount(PromptInputButton, {
      slots: { default: '<svg class="icon" />' },
    })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.find('.icon').exists()).toBe(true)
  })

  it('默认：无 active 类、title 为空', () => {
    const w = mount(PromptInputButton)
    expect(w.classes()).not.toContain('ai-chat-prompt-input-btn--active')
    expect(w.attributes('title')).toBe('')
  })

  it('正常：active 时渲染修饰类', () => {
    const w = mount(PromptInputButton, { props: { active: true } })
    expect(w.classes()).toContain('ai-chat-prompt-input-btn--active')
  })

  it('正常：tooltip 写入 title', () => {
    const w = mount(PromptInputButton, { props: { tooltip: '上传附件' } })
    expect(w.attributes('title')).toBe('上传附件')
  })

  it('正常：点击 emit click', async () => {
    const w = mount(PromptInputButton)
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('异常：disabled 时不触发 click', async () => {
    const w = mount(PromptInputButton, { props: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })
})

describe('PromptInputHeader 头部容器', () => {
  it('正常：有 slot 时渲染容器', () => {
    const w = mount(PromptInputHeader, {
      slots: { default: '<span class="hd">标题</span>' },
    })
    expect(w.classes()).toContain('ai-chat-prompt-input-header')
    expect(w.get('.hd').text()).toBe('标题')
  })

  it('边界：无 slot 时不渲染节点', () => {
    const w = mount(PromptInputHeader)
    expect(w.find('.ai-chat-prompt-input-header').exists()).toBe(false)
  })
})
