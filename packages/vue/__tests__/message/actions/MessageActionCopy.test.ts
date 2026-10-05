import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { copyText } from '@toimc/core'
import MessageActionCopy from '../../../src/message/actions/MessageActionCopy.vue'
import { setAiChatLocale } from '../../../src/locales'

vi.mock('@toimc/core', () => ({ copyText: vi.fn() }))

const iconCopy = '.ai-chat-message-action-copy__icon-copy'
const iconCheck = '.ai-chat-message-action-copy__icon-check'

beforeEach(() => {
  setAiChatLocale('zh-CN', { persist: false })
  vi.mocked(copyText).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('MessageActionCopy 复制操作', () => {
  it('正常：渲染动作按钮，title 默认取字典 messageActions.copy', () => {
    const w = mount(MessageActionCopy, { props: { text: '内容' } })
    expect(w.get('button').attributes('title')).toBe('复制')
  })

  it('正常：tooltip prop 覆盖默认 title', () => {
    const w = mount(MessageActionCopy, {
      props: { text: '内容', tooltip: '复制代码块' },
    })
    expect(w.get('button').attributes('title')).toBe('复制代码块')
  })

  it('正常：点击调用 copyText 并切换为完成图标', async () => {
    vi.mocked(copyText).mockResolvedValue(true)
    const w = mount(MessageActionCopy, { props: { text: '待复制文本' } })
    expect(w.find(iconCheck).exists()).toBe(false)
    await w.trigger('click')
    expect(copyText).toHaveBeenCalledWith('待复制文本')
    expect(w.find(iconCheck).exists()).toBe(true)
    expect(w.find(iconCopy).exists()).toBe(false)
  })

  it('正常：copied 态 2 秒后回退为复制图标', async () => {
    vi.useFakeTimers()
    vi.mocked(copyText).mockResolvedValue(true)
    const w = mount(MessageActionCopy, { props: { text: 'x' } })
    await w.trigger('click')
    expect(w.find(iconCheck).exists()).toBe(true)
    vi.advanceTimersByTime(2000)
    await vi.dynamicImportSettled()
    expect(w.find(iconCheck).exists()).toBe(false)
    expect(w.find(iconCopy).exists()).toBe(true)
  })

  it('边界：copyText 返回 false 不切换图标', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mount(MessageActionCopy, { props: { text: '' } })
    await w.trigger('click')
    expect(w.find(iconCheck).exists()).toBe(false)
  })

  it('异常：copyText 抛出拒绝不冒泡、不切换图标', async () => {
    vi.mocked(copyText).mockRejectedValue(new Error('clipboard denied'))
    const w = mount(MessageActionCopy, { props: { text: 'x' } })
    await w.trigger('click')
    expect(w.find(iconCheck).exists()).toBe(false)
  })

  it('边界：copied 态内重复点击不重复复制', async () => {
    vi.mocked(copyText).mockResolvedValue(true)
    const w = mount(MessageActionCopy, { props: { text: 'x' } })
    await w.trigger('click')
    await w.trigger('click')
    expect(copyText).toHaveBeenCalledTimes(1)
  })
})
