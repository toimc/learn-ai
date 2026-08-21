import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Message } from '@toimc/core'
import MessageList from './MessageList.vue'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'hello',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('MessageList 消息列表', () => {
  it('正常：v-for 渲染每条消息的 item 容器', () => {
    const messages = [
      makeMessage({ id: 'a', content: '第一条' }),
      makeMessage({ id: 'b', content: '第二条' }),
      makeMessage({ id: 'c', content: '第三条' }),
    ]
    const w = mount(MessageList, {
      props: { messages },
      slots: {
        default:
          '<template #default="{ message }">{{ message.content }}</template>',
      },
    })
    const items = w.findAll('.ai-chat-message-list__item')
    expect(items).toHaveLength(3)
    expect(items[1].text()).toBe('第二条')
  })

  it('正常：作用域 slot 暴露 message 数据', () => {
    const w = mount(MessageList, {
      props: {
        messages: [
          makeMessage({ id: 'x', role: 'assistant', content: '回复' }),
        ],
      },
      slots: {
        default:
          '<template #default="{ message }"><b :data-role="message.role">{{ message.content }}</b></template>',
      },
    })
    const bubble = w.get('.ai-chat-message-list__item b')
    expect(bubble.attributes('data-role')).toBe('assistant')
    expect(bubble.text()).toBe('回复')
  })

  it('边界：空数组渲染空容器', () => {
    const w = mount(MessageList, { props: { messages: [] } })
    expect(w.classes()).toContain('ai-chat-message-list')
    expect(w.findAll('.ai-chat-message-list__item')).toHaveLength(0)
  })

  it('正常：消息更新后列表响应式重渲染', async () => {
    const messages = [makeMessage({ id: 'a' })]
    const w = mount(MessageList, {
      props: { messages },
      slots: {
        default:
          '<template #default="{ message }">{{ message.content }}</template>',
      },
    })
    messages.push(makeMessage({ id: 'b', content: '新消息' }))
    await w.setProps({ messages: [...messages] })
    expect(w.findAll('.ai-chat-message-list__item')).toHaveLength(2)
  })
})
