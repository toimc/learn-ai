import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ComparisonMessage from './ComparisonMessage.vue'
import { setAiChatLocale } from '../locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

const stubs = { MessageContent: { template: '<div />' } }

describe('ComparisonMessage i18n', () => {
  it('未传 label：渲染中文字典', () => {
    const w = mount(ComparisonMessage, {
      props: { left: 'a', right: 'b' },
      global: { stubs },
    })
    expect(w.text()).toContain('回复 A')
    expect(w.text()).toContain('回复 B')
    expect(w.text()).toContain('喜欢这个')
  })

  it('传 label：props 优先', () => {
    const w = mount(ComparisonMessage, {
      props: { left: 'a', right: 'b', leftLabel: 'L', buttonLabel: '赞' },
      global: { stubs },
    })
    expect(w.text()).toContain('L')
    expect(w.text()).toContain('赞')
    expect(w.text()).not.toContain('喜欢这个')
  })

  it('切换英文：label 响应式更新', async () => {
    const w = mount(ComparisonMessage, {
      props: { left: 'a', right: 'b' },
      global: { stubs },
    })
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.text()).toContain('Response A')
    expect(w.text()).toContain('Like this')
  })
})
