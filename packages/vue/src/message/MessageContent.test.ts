import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageContent from './MessageContent.vue'

/**
 * 空窗期反馈（发送→首 token 之间）：streaming 且正文为空时渲染三点跳动指示，
 * 有正文或非流式时不渲染——否则用户面对空白气泡像卡死。
 */
describe('MessageContent 空窗期打字指示', () => {
  it('streaming 且 content 为空串时渲染三点指示', () => {
    const wrapper = mount(MessageContent, {
      props: { content: '', streaming: true },
    })
    expect(wrapper.findAll('.ai-chat-typing-dot')).toHaveLength(3)
  })

  it('streaming 且 content 为 undefined 时渲染三点指示', () => {
    const wrapper = mount(MessageContent, {
      props: { streaming: true },
    })
    expect(wrapper.findAll('.ai-chat-typing-dot')).toHaveLength(3)
  })

  it('已有正文时不渲染指示（光标交由 markdown 渲染层）', () => {
    const wrapper = mount(MessageContent, {
      props: { content: '你好', streaming: true },
    })
    expect(wrapper.find('.ai-chat-typing-dot').exists()).toBe(false)
  })

  it('非 streaming 时不渲染指示', () => {
    const wrapper = mount(MessageContent, {
      props: { content: '', streaming: false },
    })
    expect(wrapper.find('.ai-chat-typing-dot').exists()).toBe(false)
  })

  it('thinking 进行中时不渲染指示（思考面板即反馈）', () => {
    const wrapper = mount(MessageContent, {
      props: {
        content: '',
        streaming: true,
        thinking: { content: '推理中' },
      },
    })
    expect(wrapper.find('.ai-chat-typing-dot').exists()).toBe(false)
  })
})
