import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useClipboard } from '../../src/composables/useClipboard'
import { copyText } from '@toimc/core'

// mock 边界在 core 模块：useClipboard 只做响应式包装，复制链路属 core 职责
vi.mock('@toimc/core', () => ({
  copyText: vi.fn(),
}))

const mockCopyText = vi.mocked(copyText)

beforeEach(() => {
  mockCopyText.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** 在组件 setup 内调用 useClipboard，暴露其返回值以便断言 */
function mountWithClipboard(resetDelay?: number) {
  let exposed!: ReturnType<typeof useClipboard>
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useClipboard(resetDelay)
        return () => null
      },
    }),
  )
  return { wrapper, exposed }
}

describe('useClipboard copy 复制成功', () => {
  it('正常：成功后 copied 为 true 并透传文本给 core copyText', async () => {
    mockCopyText.mockResolvedValue(true)
    const { copied, copy } = useClipboard()

    const ok = await copy('hello')

    expect(ok).toBe(true)
    expect(copied.value).toBe(true)
    expect(mockCopyText).toHaveBeenCalledExactlyOnceWith('hello')
  })

  it('边界：默认 1500ms 后 copied 复位为 false', async () => {
    mockCopyText.mockResolvedValue(true)
    const { copied, copy } = useClipboard()

    await copy('hello')
    vi.advanceTimersByTime(1499)
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(copied.value).toBe(false)
  })

  it('边界：自定义 resetDelay 生效', async () => {
    mockCopyText.mockResolvedValue(true)
    const { copied, copy } = useClipboard(300)

    await copy('hello')
    vi.advanceTimersByTime(299)
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(copied.value).toBe(false)
  })

  it('正常：复位窗口内再次 copy 重置计时器', async () => {
    mockCopyText.mockResolvedValue(true)
    const { copied, copy } = useClipboard(1500)

    await copy('first')
    vi.advanceTimersByTime(1000)
    await copy('second')
    // 距第二次 copy 仅 1000ms < 1500ms，不应复位
    vi.advanceTimersByTime(1000)
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(500)
    expect(copied.value).toBe(false)
    expect(mockCopyText).toHaveBeenCalledTimes(2)
  })
})

describe('useClipboard copy 失败路径', () => {
  it('异常：copyText 返回 false 时 copied 保持 false 且返回 false', async () => {
    mockCopyText.mockResolvedValue(false)
    const { copied, copy } = useClipboard()

    const ok = await copy('fail')

    expect(ok).toBe(false)
    expect(copied.value).toBe(false)
    vi.advanceTimersByTime(60000)
    expect(copied.value).toBe(false)
  })

  it('异常：copyText 意外 reject 时不抛出，按失败处理', async () => {
    mockCopyText.mockRejectedValue(new Error('boom'))
    const { copied, copy } = useClipboard()

    await expect(copy('boom')).resolves.toBe(false)
    expect(copied.value).toBe(false)
  })
})

describe('useClipboard 作用域清理', () => {
  it('正常：组件卸载后清理复位定时器，copied 不再翻转', async () => {
    mockCopyText.mockResolvedValue(true)
    const { wrapper, exposed } = mountWithClipboard(1500)

    await exposed.copy('hello')
    expect(exposed.copied.value).toBe(true)

    wrapper.unmount()
    vi.advanceTimersByTime(60000)
    // 定时器已随作用域销毁被清理：卸载后不复位
    expect(exposed.copied.value).toBe(true)
  })

  it('正常：组件作用域外（无活跃 effect scope）调用不报错且功能完整', async () => {
    mockCopyText.mockResolvedValue(true)
    const { copied, copy } = useClipboard()

    const ok = await copy('bare')

    expect(ok).toBe(true)
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(copied.value).toBe(false)
  })
})
