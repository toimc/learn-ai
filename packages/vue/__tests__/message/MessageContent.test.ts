import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageContent from '../../src/message/MessageContent.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

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

describe('MessageContent 思考块流式信号收窄', () => {
  it('消息流式中且思考进行中（active=true）：思考块显示"正在思考…"与光标', () => {
    const wrapper = mount(MessageContent, {
      props: {
        content: '',
        streaming: true,
        thinking: { content: '推理中', active: true },
      },
    })
    expect(wrapper.get('.ai-chat-thinking__label').text()).toBe('正在思考…')
    expect(wrapper.find('.ai-chat-thinking__cursor').exists()).toBe(true)
  })

  it('消息流式中但思考已结束（active=false）：不显示"正在思考…"与思考光标', () => {
    const wrapper = mount(MessageContent, {
      props: {
        content: '正文在流式输出',
        streaming: true,
        thinking: { content: '想完了', active: false, duration: 1200 },
      },
    })
    // 思考已收尾：回到"已思考 X 秒"，光标只在正文处（markdown 层）
    expect(wrapper.get('.ai-chat-thinking__label').text()).toBe('已思考 1.2 秒')
    expect(wrapper.find('.ai-chat-thinking__cursor').exists()).toBe(false)
  })

  it('thinking 无 active 信号时保持现状（视为进行中），兼容宿主自组装消息', () => {
    const wrapper = mount(MessageContent, {
      props: {
        content: '',
        streaming: true,
        thinking: { content: '推理中' },
      },
    })
    expect(wrapper.get('.ai-chat-thinking__label').text()).toBe('正在思考…')
  })
})
