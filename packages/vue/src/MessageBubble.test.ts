import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Message } from '@toimc/core'
import MessageBubble from './MessageBubble.vue'

function makeMessage(role: 'user' | 'assistant'): Message {
  return {
    id: `m_${role}`,
    role,
    content: '内容',
    createdAt: new Date(),
  }
}

describe('MessageBubble 气泡布局', () => {
  it.each(['user', 'assistant'] as const)(
    '正常：role=%s 渲染对应修饰类',
    (role) => {
      const w = mount(MessageBubble, {
        props: { message: makeMessage(role) },
      })
      expect(w.classes()).toContain(`ai-chat-bubble--${role}`)
    },
  )

  it('正常：默认 slot 渲染正文内容', () => {
    const w = mount(MessageBubble, {
      props: { message: makeMessage('assistant') },
      slots: { default: '<p class="content">正文</p>' },
    })
    expect(w.get('.ai-chat-bubble__content p').text()).toBe('正文')
  })

  it('正常：avatar 具名 slot 渲染头像位', () => {
    const w = mount(MessageBubble, {
      props: { message: makeMessage('user') },
      slots: { avatar: '<img class="avatar" alt="头像" />' },
    })
    expect(w.find('.ai-chat-bubble__avatar img.avatar').exists()).toBe(true)
  })

  it('正常：actions 具名 slot 渲染操作位', () => {
    const w = mount(MessageBubble, {
      props: { message: makeMessage('user') },
      slots: { actions: '<button class="act">复制</button>' },
    })
    expect(w.get('.ai-chat-bubble__actions .act').text()).toBe('复制')
  })

  it('边界：未填 slot 时三个区域节点仍存在（布局稳定）', () => {
    const w = mount(MessageBubble, {
      props: { message: makeMessage('assistant') },
    })
    expect(w.find('.ai-chat-bubble__avatar').exists()).toBe(true)
    expect(w.find('.ai-chat-bubble__content').exists()).toBe(true)
    expect(w.find('.ai-chat-bubble__actions').exists()).toBe(true)
  })
})
