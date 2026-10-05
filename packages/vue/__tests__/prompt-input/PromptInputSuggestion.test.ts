import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInputSuggestion from '../../src/prompt-input/PromptInputSuggestion.vue'
import type { SuggestionTrigger } from '../../src/prompt-input/suggestions'
import { setAiChatLocale } from '../../src/locales'

const triggers: SuggestionTrigger[] = [
  {
    char: '/',
    items: [
      { key: 'h1', label: '标题 1', description: '大标题' },
      { key: 'h2', label: '标题 2' },
      { key: 'table', label: '表格' },
    ],
  },
]

const wrappers: VueWrapper[] = []

function mountSuggestion(
  props: Record<string, unknown> = {},
  stubTeleport = true,
) {
  const w = mount(PromptInputSuggestion, {
    props: { text: '/标', caret: 3, triggers, ...props },
    global: stubTeleport ? { stubs: { teleport: true } } : {},
  })
  wrappers.push(w)
  return w
}

function pressKey(key: string, init: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  document.dispatchEvent(ev)
  return ev
}

// i18n 单例跨测试文件共享，锁定中文避免空文案断言受邻文件切语言影响
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  setAiChatLocale('zh-CN', { persist: false })
})

describe('PromptInputSuggestion 渲染与过滤', () => {
  it('正常：触发激活时渲染菜单，按 query 过滤并高亮首项', async () => {
    const w = mountSuggestion()
    await new Promise((r) => setTimeout(r))
    const menu = w.find('.ai-chat-prompt-input-suggestion')
    expect(menu.exists()).toBe(true)
    const labels = w
      .findAll('.ai-chat-prompt-input-suggestion__label')
      .map((n) => n.text())
    expect(labels).toEqual(['标题 1', '标题 2'])
    const items = w.findAll('.ai-chat-prompt-input-suggestion__item')
    expect(items[0].classes()).toContain(
      'ai-chat-prompt-input-suggestion__item--active',
    )
    expect(items[0].attributes('aria-selected')).toBe('true')
    expect(items[1].attributes('aria-selected')).toBe('false')
  })

  it('正常：description 渲染，缺失时不渲染占位', async () => {
    const w = mountSuggestion()
    await new Promise((r) => setTimeout(r))
    const descs = w.findAll('.ai-chat-prompt-input-suggestion__desc')
    expect(descs).toHaveLength(1)
    expect(descs[0].text()).toBe('大标题')
  })

  it('边界：无触发词时不渲染菜单', () => {
    const w = mountSuggestion({ text: '普通文本', caret: 4 })
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(false)
  })

  it('边界：query 无匹配显示 i18n 空文案', async () => {
    const w = mountSuggestion({ text: '/zz', caret: 3 })
    await new Promise((r) => setTimeout(r))
    expect(w.findAll('.ai-chat-prompt-input-suggestion__item')).toHaveLength(0)
    expect(w.find('.ai-chat-prompt-input-suggestion__empty').text()).toBe(
      '无匹配项',
    )
  })

  it('正常：query 变化后过滤结果与高亮复位', async () => {
    const w = mountSuggestion()
    await w.setProps({ text: '/', caret: 1 })
    expect(w.findAll('.ai-chat-prompt-input-suggestion__item')).toHaveLength(3)
    await w.setProps({ text: '/表', caret: 3 })
    const labels = w
      .findAll('.ai-chat-prompt-input-suggestion__label')
      .map((n) => n.text())
    expect(labels).toEqual(['表格'])
    expect(
      w.findAll('.ai-chat-prompt-input-suggestion__item')[0].classes(),
    ).toContain('ai-chat-prompt-input-suggestion__item--active')
  })
})

describe('PromptInputSuggestion 键盘交互', () => {
  it('正常：ArrowDown/ArrowUp 导航且到边界回卷', async () => {
    const w = mountSuggestion({ text: '/', caret: 1 })
    pressKey('ArrowDown')
    await new Promise((r) => setTimeout(r))
    let items = w.findAll('.ai-chat-prompt-input-suggestion__item')
    expect(items[1].classes()).toContain(
      'ai-chat-prompt-input-suggestion__item--active',
    )
    // 首项上翻回卷到末项
    pressKey('ArrowUp')
    pressKey('ArrowUp')
    await new Promise((r) => setTimeout(r))
    items = w.findAll('.ai-chat-prompt-input-suggestion__item')
    expect(items[2].classes()).toContain(
      'ai-chat-prompt-input-suggestion__item--active',
    )
    // 末项下翻回卷回首项
    pressKey('ArrowDown')
    await new Promise((r) => setTimeout(r))
    items = w.findAll('.ai-chat-prompt-input-suggestion__item')
    expect(items[0].classes()).toContain(
      'ai-chat-prompt-input-suggestion__item--active',
    )
  })

  it('正常：Enter 选中当前项并回传完整替换文本', async () => {
    const w = mountSuggestion({ text: '/标', caret: 3 })
    pressKey('Enter')
    await new Promise((r) => setTimeout(r))
    expect(w.emitted('select')).toEqual([[triggers[0].items[0], '标题 1']])
  })

  it('正常：光标在触发词中间，nextText 只替换触发符到光标', async () => {
    const localTriggers: SuggestionTrigger[] = [
      { char: '/', items: [{ key: 'hd', label: 'header' }] },
    ]
    const w = mountSuggestion({
      text: 'hi /head',
      caret: 6,
      triggers: localTriggers,
    })
    pressKey('Enter')
    await new Promise((r) => setTimeout(r))
    // '/he' 被替换为 'header'，光标后的 'ad' 保留
    expect(w.emitted('select')![0]).toEqual([
      localTriggers[0].items[0],
      'hi headerad',
    ])
  })

  it('正常：Enter 拦截 textarea 默认行为与监听（capture stopPropagation）', async () => {
    const w = mountSuggestion({ text: '/', caret: 1 })
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const heard = vi.fn()
    ta.addEventListener('keydown', heard)
    const ev = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(ev)
    await new Promise((r) => setTimeout(r))
    expect(ev.defaultPrevented).toBe(true)
    expect(heard).not.toHaveBeenCalled()
    expect(w.emitted('select')).toHaveLength(1)
    ta.remove()
  })

  it('边界：IME 组合中的 Enter 不拦截不选中', async () => {
    const w = mountSuggestion({ text: '/', caret: 1 })
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    const ev = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(ev, 'isComposing', { value: true })
    ta.dispatchEvent(ev)
    await new Promise((r) => setTimeout(r))
    expect(ev.defaultPrevented).toBe(false)
    expect(w.emitted('select')).toBeUndefined()
    ta.remove()
  })

  it('边界：无匹配项时 Enter 不拦截（放行宿主发送/换行）', async () => {
    const w = mountSuggestion({ text: '/zz', caret: 3 })
    const ev = pressKey('Enter')
    await new Promise((r) => setTimeout(r))
    expect(ev.defaultPrevented).toBe(false)
    expect(w.emitted('select')).toBeUndefined()
  })

  it('正常：Escape 关闭并抑制冒泡，同一触发会话内保持关闭，会话结束复位', async () => {
    const w = mountSuggestion({ text: '/标', caret: 3 })
    const ev = pressKey('Escape')
    await new Promise((r) => setTimeout(r))
    expect(ev.defaultPrevented).toBe(true)
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(false)
    // 光标仍在触发词内（props 未变）不自动复活
    await w.setProps({ caret: 3 })
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(false)
    // 触发会话结束（光标离开）后再进入新会话可重新打开
    await w.setProps({ text: 'plain', caret: 5 })
    await w.setProps({ text: '/标', caret: 3 })
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(true)
  })
})

describe('PromptInputSuggestion 指针交互与挂载', () => {
  it('正常：mousedown 选中并阻止默认（不抢 textarea 焦点），选中后关闭', async () => {
    const w = mountSuggestion()
    const el = w.findAll('.ai-chat-prompt-input-suggestion__item')[1].element
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
    await new Promise((r) => setTimeout(r))
    expect(ev.defaultPrevented).toBe(true)
    expect(w.emitted('select')![0]).toEqual([triggers[0].items[1], '标题 2'])
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(false)
  })

  it('正常：菜单外 pointerdown 关闭（emit close）', async () => {
    const w = mountSuggestion()
    const ev = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(ev)
    await new Promise((r) => setTimeout(r))
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.find('.ai-chat-prompt-input-suggestion').exists()).toBe(false)
  })

  it('正常：传 anchor 时挂进 anchor 元素，绝对定位类生效', async () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    const w = mountSuggestion({}, false)
    // 先验证缺省直挂 body：fixed 修饰类
    const floating = document.querySelector('.ai-chat-prompt-input-suggestion')
    expect(floating).not.toBeNull()
    expect(floating!.classList).toContain(
      'ai-chat-prompt-input-suggestion--fixed',
    )
    w.unmount()
    wrappers.pop()
    // anchor 模式：菜单是 anchor 的子元素，非 fixed
    const w2 = mount(PromptInputSuggestion, {
      props: { text: '/标', caret: 3, triggers, anchor },
      attachTo: anchor,
    })
    wrappers.push(w2)
    const menu = anchor.querySelector('.ai-chat-prompt-input-suggestion')
    expect(menu).not.toBeNull()
    expect(menu!.classList).not.toContain(
      'ai-chat-prompt-input-suggestion--fixed',
    )
    anchor.remove()
  })
})
