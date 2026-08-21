import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import Message from './Message.vue'
import { messageLayoutKey } from '../composables/layout-types'

function mountWith(
  ctx: { layout: 'stacked' | 'im'; messageAlign: 'left' | 'right' } | null,
  from: 'user' | 'assistant' = 'user',
) {
  const provides =
    ctx === null
      ? {}
      : { [messageLayoutKey as unknown as symbol]: computed(() => ctx) }
  return mount(Message, { props: { from }, global: { provide: provides } })
}

describe('Message 布局修饰类', () => {
  it('无注入时回退现状（无 layout 类）', () => {
    const w = mountWith(null)
    expect(w.classes()).not.toContain('ai-chat-message--layout-im')
  })
  it('stacked 模式标记 layout-stacked', () => {
    const w = mountWith({ layout: 'stacked', messageAlign: 'left' })
    expect(w.classes()).toContain('ai-chat-message--layout-stacked')
  })
  it('im + user 在右侧：user 消息带 user-side-right', () => {
    const w = mountWith({ layout: 'im', messageAlign: 'right' }, 'user')
    expect(w.classes()).toContain('ai-chat-message--layout-im')
    expect(w.classes()).toContain('ai-chat-message--user-side-right')
  })
  it('im + user 在左侧：assistant 消息带 user-side-left（assistant 在右）', () => {
    const w = mountWith({ layout: 'im', messageAlign: 'left' }, 'assistant')
    expect(w.classes()).toContain('ai-chat-message--user-side-left')
  })
})
