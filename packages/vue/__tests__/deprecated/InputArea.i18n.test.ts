import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import InputArea from '../../src/deprecated/InputArea.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('InputArea i18n', () => {
  it('按钮文案走字典（zh：发送）', () => {
    const w = mount(InputArea)
    expect(w.text()).toContain('发送')
    w.get('textarea').setValue('hi')
    expect(w.text()).not.toContain('停止')
  })

  it('disabled 时显示停止（zh）', () => {
    const w = mount(InputArea, { props: { disabled: true } })
    expect(w.text()).toContain('停止')
  })

  it('切换英文：Stop', async () => {
    const w = mount(InputArea, { props: { disabled: true } })
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.text()).toContain('Stop')
  })

  it('placeholder 回退字典', () => {
    const w = mount(InputArea)
    expect(w.get('textarea').attributes('placeholder')).toBe('输入消息...')
  })

  it('传 placeholder：props 优先', () => {
    const w = mount(InputArea, { props: { placeholder: '自定义' } })
    expect(w.get('textarea').attributes('placeholder')).toBe('自定义')
  })
})
