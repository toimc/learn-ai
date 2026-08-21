import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MultimodalInputDemo from './MultimodalInputDemo.vue'

describe('MultimodalInputDemo', () => {
  it('渲染独立演示区：标题、两个上传按钮、payload 空态', () => {
    const w = mount(MultimodalInputDemo)
    expect(w.find('.pg-demo-card__title').exists()).toBe(true)
    expect(
      w.findAll('.ai-chat-prompt-input-btn').length,
    ).toBeGreaterThanOrEqual(2)
    expect(w.find('.pg-demo-card__payload-empty').exists()).toBe(true)
  })

  it('输入文本 Alt+Enter 发送后 payload 面板展示文本', async () => {
    const w = mount(MultimodalInputDemo)
    const textarea = w.get('textarea')
    await textarea.setValue('你好多模态')
    await textarea.trigger('keydown', { key: 'Enter', altKey: true })
    expect(w.find('.pg-demo-card__payload-body').exists()).toBe(true)
    expect(w.get('.pg-demo-card__payload-body').text()).toContain('你好多模态')
  })

  it('payload 面板可清空', async () => {
    const w = mount(MultimodalInputDemo)
    const textarea = w.get('textarea')
    await textarea.setValue('hello')
    await textarea.trigger('keydown', { key: 'Enter', altKey: true })
    await w.get('.pg-demo-card__reset').trigger('click')
    expect(w.find('.pg-demo-card__payload-empty').exists()).toBe(true)
  })
})
