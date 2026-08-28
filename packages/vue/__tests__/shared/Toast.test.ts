import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '../../src/shared/Toast.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

type ToastType = 'info' | 'success' | 'error' | 'warning'
type ToastPlacement =
  'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right'

function mountToast(props: {
  message: string
  type?: ToastType
  duration?: number
  placement?: ToastPlacement
}) {
  return mount(Toast, { props })
}

describe('Toast 渲染', () => {
  it('默认 props：渲染 message 文本，带 --info 修饰类与 role="status"', () => {
    const w = mountToast({ message: '你好，世界' })
    expect(w.classes()).toContain('ai-chat-toast')
    expect(w.classes()).toContain('ai-chat-toast--info')
    expect(w.attributes('role')).toBe('status')
    expect(w.get('.ai-chat-toast__message').text()).toBe('你好，世界')
    expect(w.find('.ai-chat-toast__icon').exists()).toBe(true)
  })

  it.each(['info', 'success', 'error', 'warning'] as const)(
    'type=%s 渲染对应修饰符类',
    (type) => {
      const w = mountToast({ message: 'msg', type })
      expect(w.classes()).toContain(`ai-chat-toast--${type}`)
    },
  )

  it('type=error 时 role="alert"，其余 role="status"', () => {
    expect(
      mountToast({ message: 'msg', type: 'error' }).attributes('role'),
    ).toBe('alert')
    expect(
      mountToast({ message: 'msg', type: 'success' }).attributes('role'),
    ).toBe('status')
    expect(
      mountToast({ message: 'msg', type: 'warning' }).attributes('role'),
    ).toBe('status')
  })

  it('关闭按钮带 aria-label="关闭"', () => {
    const w = mountToast({ message: 'msg' })
    expect(w.get('.ai-chat-toast__close').attributes('aria-label')).toBe('关闭')
  })

  it('默认 placement=top：渲染 --top 修饰类', () => {
    const w = mountToast({ message: 'msg' })
    expect(w.classes()).toContain('ai-chat-toast--top')
  })

  it.each([
    'top',
    'top-left',
    'top-right',
    'bottom',
    'bottom-left',
    'bottom-right',
  ] as const)('placement=%s 渲染对应修饰符类', (placement) => {
    const w = mountToast({ message: 'msg', placement })
    expect(w.classes()).toContain(`ai-chat-toast--${placement}`)
  })

  it('placement 与 type 修饰类共存', () => {
    const w = mountToast({
      message: 'msg',
      type: 'error',
      placement: 'bottom-right',
    })
    expect(w.classes()).toContain('ai-chat-toast--error')
    expect(w.classes()).toContain('ai-chat-toast--bottom-right')
  })
})

describe('Toast 自动关闭计时', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认 duration=3000：到期触发一次 close', () => {
    const w = mountToast({ message: 'msg' })
    vi.advanceTimersByTime(2999)
    expect(w.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('自定义 duration=1000：advance 1000 触发 close', () => {
    const w = mountToast({ message: 'msg', duration: 1000 })
    vi.advanceTimersByTime(1000)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('duration=0：不自动关闭', () => {
    const w = mountToast({ message: 'msg', duration: 0 })
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(w.emitted('close')).toBeUndefined()
  })

  it('点击关闭按钮触发 close，且计时器不再重复触发', async () => {
    const w = mountToast({ message: 'msg' })
    await w.get('.ai-chat-toast__close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    // 手动关闭后自动计时应被清除，不再补发第二次 close
    vi.advanceTimersByTime(3000)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('卸载后计时器清理：advance 不报错、无多余 emit', () => {
    const w = mountToast({ message: 'msg', duration: 2000 })
    w.unmount()
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('duration 动态变化重置计时：按新时长触发', async () => {
    const w = mountToast({ message: 'msg', duration: 3000 })
    vi.advanceTimersByTime(1500)
    expect(w.emitted('close')).toBeUndefined()
    await w.setProps({ duration: 1000 })
    // 计时从头开始：旧的 1500ms 不累计
    vi.advanceTimersByTime(999)
    expect(w.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(w.emitted('close')).toHaveLength(1)
  })
})
