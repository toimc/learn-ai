import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Attachments from '../../src/attachment/Attachments.vue'
import AttachmentEmpty from '../../src/attachment/AttachmentEmpty.vue'
import AttachmentRemove from '../../src/attachment/AttachmentRemove.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('Attachments 附件容器', () => {
  it('默认：variant 为 grid', () => {
    const w = mount(Attachments)
    expect(w.classes()).toContain('ai-chat-attachments--grid')
  })

  it.each(['grid', 'inline', 'list'] as const)(
    'variant=%s 渲染对应修饰类',
    (variant) => {
      const w = mount(Attachments, { props: { variant } })
      expect(w.classes()).toContain(`ai-chat-attachments--${variant}`)
    },
  )

  it('正常：slot 子项透传', () => {
    const w = mount(Attachments, {
      slots: { default: '<div class="item">a</div><div class="item">b</div>' },
    })
    expect(w.findAll('.item')).toHaveLength(2)
  })
})

describe('AttachmentEmpty 空态', () => {
  it('正常：默认文案"暂无附件"', () => {
    const w = mount(AttachmentEmpty)
    expect(w.get('.ai-chat-attachment-empty').text()).toBe('暂无附件')
  })

  it('正常：slot 覆盖默认文案', () => {
    const w = mount(AttachmentEmpty, {
      slots: { default: '还没有文件' },
    })
    expect(w.get('.ai-chat-attachment-empty').text()).toBe('还没有文件')
  })
})

describe('AttachmentRemove 移除按钮', () => {
  it('正常：渲染为 button 并展示关闭图标', () => {
    const w = mount(AttachmentRemove)
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.find('svg').exists()).toBe(true)
  })

  it('正常：点击 emit remove', async () => {
    const w = mount(AttachmentRemove)
    await w.trigger('click')
    expect(w.emitted('remove')).toHaveLength(1)
  })
})
