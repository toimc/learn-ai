import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageAction from '../../src/message/MessageAction.vue'
import MessageActions from '../../src/message/MessageActions.vue'
import MessageAttachments from '../../src/message/MessageAttachments.vue'

describe('MessageAction 操作按钮', () => {
  it('正常：label 渲染为 label span', () => {
    const w = mount(MessageAction, { props: { label: '复制' } })
    expect(w.get('.ai-chat-message-action__label').text()).toBe('复制')
  })

  it('正常：tooltip 优先作为 title', () => {
    const w = mount(MessageAction, {
      props: { label: '复制', tooltip: '复制到剪贴板' },
    })
    expect(w.attributes('title')).toBe('复制到剪贴板')
  })

  it('边界：无 tooltip 时 title 回退 label', () => {
    const w = mount(MessageAction, { props: { label: '重试' } })
    expect(w.attributes('title')).toBe('重试')
  })

  it('正常：点击 emit click', async () => {
    const w = mount(MessageAction)
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('异常：disabled 时禁用且不触发 click', async () => {
    const w = mount(MessageAction, { props: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('正常：slot 内容覆盖默认 label 渲染', () => {
    const w = mount(MessageAction, {
      props: { label: '复制' },
      slots: { default: '<svg class="icon" />' },
    })
    expect(w.find('.icon').exists()).toBe(true)
    expect(w.find('.ai-chat-message-action__label').exists()).toBe(false)
  })
})

describe('MessageActions 操作按钮容器', () => {
  it('正常：slot 子按钮透传', () => {
    const w = mount(MessageActions, {
      slots: {
        default: '<button class="act">a</button><button class="act">b</button>',
      },
    })
    expect(w.classes()).toContain('ai-chat-message-actions')
    expect(w.findAll('.act')).toHaveLength(2)
  })
})

describe('MessageAttachments 附件容器', () => {
  it('正常：slot 子项透传', () => {
    const w = mount(MessageAttachments, {
      slots: { default: '<span class="att">file.png</span>' },
    })
    expect(w.classes()).toContain('ai-chat-message-attachments')
    expect(w.get('.att').text()).toBe('file.png')
  })
})
