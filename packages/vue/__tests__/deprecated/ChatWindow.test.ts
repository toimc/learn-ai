import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatWindow from '../../src/deprecated/ChatWindow.vue'

describe('ChatWindow 窗口容器', () => {
  it('边界：未传 height 时默认 100%', () => {
    const w = mount(ChatWindow)
    expect(w.get('.ai-chat-window').attributes('style')).toContain(
      'height: 100%',
    )
  })

  it('正常：height 透传为内联高度', () => {
    const w = mount(ChatWindow, { props: { height: '480px' } })
    expect(w.get('.ai-chat-window').attributes('style')).toContain(
      'height: 480px',
    )
  })

  it('正常：默认 slot 渲染在 body 区域', () => {
    const w = mount(ChatWindow, {
      slots: { default: '<div class="body-content">消息区</div>' },
    })
    expect(w.find('.ai-chat-window__body .body-content').exists()).toBe(true)
  })

  it('正常：footer 具名 slot 渲染在底部区域', () => {
    const w = mount(ChatWindow, {
      slots: { footer: '<div class="footer-content">输入区</div>' },
    })
    expect(w.find('.ai-chat-window__footer .footer-content').exists()).toBe(
      true,
    )
  })
})
