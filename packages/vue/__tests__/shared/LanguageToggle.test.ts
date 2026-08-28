import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LanguageToggle from '../../src/shared/LanguageToggle.vue'
import { aiChatI18n, setAiChatLocale } from '../../src/locales'

const menu = () => document.body.querySelector('.ai-chat-lang-toggle__menu')
const options = () =>
  Array.from(document.body.querySelectorAll('.ai-chat-lang-toggle__option'))

// i18n 是模块级单例，跑完必须还原，避免污染同 worker 内其他测试文件
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('LanguageToggle 渲染', () => {
  it('默认显示当前语言 label', () => {
    const w = mount(LanguageToggle)
    expect(w.get('.ai-chat-lang-toggle__label').text()).toBe('简体中文')
    w.unmount()
  })

  it('可控模式：modelValue=en-US 显示 English', () => {
    const w = mount(LanguageToggle, { props: { modelValue: 'en-US' } })
    expect(w.get('.ai-chat-lang-toggle__label').text()).toBe('English')
    w.unmount()
  })
})

describe('LanguageToggle 交互', () => {
  it('点击触发器展开/收起菜单（Teleport 到 body）', async () => {
    const w = mount(LanguageToggle)
    expect(menu()).toBeNull()
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    expect(menu()).not.toBeNull()
    expect(options()).toHaveLength(2)
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    expect(menu()).toBeNull()
    w.unmount()
  })

  it('选择语言：全局 locale 变更 + 双事件 + label 更新', async () => {
    const w = mount(LanguageToggle)
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    await options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(aiChatI18n.global.locale.value).toBe('en-US')
    expect(w.emitted('change')).toEqual([['en-US']])
    expect(w.emitted('update:modelValue')).toEqual([['en-US']])
    expect(w.get('.ai-chat-lang-toggle__label').text()).toBe('English')
    w.unmount()
  })

  it('可控模式选择：只 emit 不改全局 locale', async () => {
    const w = mount(LanguageToggle, { props: { modelValue: 'zh-CN' } })
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    await options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(aiChatI18n.global.locale.value).toBe('zh-CN')
    expect(w.emitted('update:modelValue')).toEqual([['en-US']])
    w.unmount()
  })

  it('点击组件外部关闭菜单', async () => {
    const w = mount(LanguageToggle)
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    expect(menu()).not.toBeNull()
    document.body.click()
    await nextTick()
    expect(menu()).toBeNull()
    w.unmount()
  })

  it('Esc 关闭菜单', async () => {
    const w = mount(LanguageToggle)
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(menu()).toBeNull()
    w.unmount()
  })

  it('当前语言项带 is-selected 与 aria-selected', async () => {
    const w = mount(LanguageToggle)
    await w.get('.ai-chat-lang-toggle__trigger').trigger('click')
    const first = options()[0]
    expect(first.classList.contains('is-selected')).toBe(true)
    expect(first.getAttribute('aria-selected')).toBe('true')
    w.unmount()
  })
})
