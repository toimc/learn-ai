import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Welcome from '../../src/welcome/Welcome.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('Welcome i18n 默认文案', () => {
  it('未传 props：渲染中文字典文案', () => {
    const w = mount(Welcome)
    expect(w.get('.ai-chat-welcome__title').text()).toBe('有什么可以帮你的？')
    expect(w.get('.ai-chat-welcome__desc').text()).toBe(
      '选择一个话题开始，或直接输入你的问题',
    )
  })

  it('传 props：props 优先于字典', () => {
    const w = mount(Welcome, {
      props: { title: '欢迎使用组件库', description: '从下面的建议开始' },
    })
    expect(w.get('.ai-chat-welcome__title').text()).toBe('欢迎使用组件库')
    expect(w.get('.ai-chat-welcome__desc').text()).toBe('从下面的建议开始')
  })

  it('切换英文：文案响应式更新', async () => {
    const w = mount(Welcome)
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.get('.ai-chat-welcome__title').text()).toBe('How can I help you?')
    expect(w.get('.ai-chat-welcome__desc').text()).toBe(
      'Pick a topic to get started, or type your question',
    )
  })
})

describe('Welcome 插槽', () => {
  it('icon 插槽渲染到头部图标区', () => {
    const w = mount(Welcome, {
      slots: {
        icon: '<img data-test="custom-icon" src="logo.png" alt="logo">',
      },
    })
    expect(
      w.find('.ai-chat-welcome__icon [data-test="custom-icon"]').exists(),
    ).toBe(true)
  })

  it('未传 icon 插槽：渲染默认 svg 图标', () => {
    const w = mount(Welcome)
    expect(w.find('.ai-chat-welcome__icon svg').exists()).toBe(true)
  })

  it('default 插槽渲染到内容区（通常放 Prompts）', () => {
    const w = mount(Welcome, {
      slots: { default: '<div data-test="content">建议词列表</div>' },
    })
    expect(
      w.get('.ai-chat-welcome__content [data-test="content"]').text(),
    ).toBe('建议词列表')
  })

  it('extra 插槽渲染到底部附加区', () => {
    const w = mount(Welcome, {
      slots: { extra: '<a data-test="extra-link" href="#terms">服务条款</a>' },
    })
    expect(
      w.get('.ai-chat-welcome__extra [data-test="extra-link"]').text(),
    ).toBe('服务条款')
  })

  it('未传 extra 插槽：不渲染 extra 容器', () => {
    const w = mount(Welcome)
    expect(w.find('.ai-chat-welcome__extra').exists()).toBe(false)
  })
})

describe('Welcome 结构', () => {
  it('渲染顺序：图标区 → 标题 → 描述 → 内容区 → 附加区', () => {
    const w = mount(Welcome, {
      slots: {
        default: '<p>内容</p>',
        extra: '<p>附加</p>',
      },
    })
    const classes = Array.from(w.element.children).map(
      (el) => (el as HTMLElement).classList[0],
    )
    expect(classes).toEqual([
      'ai-chat-welcome__icon',
      'ai-chat-welcome__title',
      'ai-chat-welcome__desc',
      'ai-chat-welcome__content',
      'ai-chat-welcome__extra',
    ])
  })
})
