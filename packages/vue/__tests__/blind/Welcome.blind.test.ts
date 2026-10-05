/**
 * 双盲测试：Welcome
 * 契约来源：packages/docs/components/welcome.md（未读实现源码）
 * 文档写明默认文案：en welcome.title = 'How can I help you?'
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Welcome, setAiChatLocale } from '@toimc/vue'
import { norm } from './helpers'

const mounted: VueWrapper[] = []

function mountWelcome(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  const w = mount(Welcome, { props, slots, attachTo: document.body })
  mounted.push(w)
  return w
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('Welcome（契约：docs/components/welcome.md）', () => {
  it('title 缺省走 i18n（en-US 默认 How can I help you?）', () => {
    const w = mountWelcome()
    expect(w.text()).toContain('How can I help you?')
  })

  it('title prop 优先于 i18n 默认', () => {
    const w = mountWelcome({ title: 'Hi there' })
    expect(w.text()).toContain('Hi there')
    expect(w.text()).not.toContain('How can I help you?')
  })

  it('description 缺省时渲染 i18n 描述行（文本不止标题）', () => {
    const w = mountWelcome()
    expect(norm(w.text())).not.toBe('How can I help you?')
  })

  it('description 传空字符串则描述行不渲染', () => {
    const w = mountWelcome({ description: '' })
    expect(norm(w.text())).toBe('How can I help you?')
  })

  it('default 插槽渲染内容区', () => {
    const w = mountWelcome({}, { default: '<p class="body">BODY CONTENT</p>' })
    expect(w.text()).toContain('BODY CONTENT')
  })

  it('extra 插槽：未传不渲染，传入则渲染', () => {
    const without = mountWelcome()
    expect(without.text()).not.toContain('TERMS OF SERVICE')

    const withExtra = mountWelcome(
      {},
      { extra: '<a href="/terms">TERMS OF SERVICE</a>' },
    )
    expect(withExtra.text()).toContain('TERMS OF SERVICE')
  })

  it('icon 插槽替换默认星形 svg 徽标', () => {
    const withIcon = mountWelcome({}, { icon: '<img class="logo" alt="logo">' })
    expect(withIcon.find('img.logo').exists()).toBe(true)
    expect(withIcon.findAll('svg')).toHaveLength(0)
  })
})
