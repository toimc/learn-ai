import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from '../../src/utils/clipboard'
import type { Mock } from 'vitest'

// jsdom 无 Clipboard API，document 上也不存在 execCommand 属性（spyOn 不可用），
// 两条路径全部用 defineProperty 注入 mock；
// 断言落点：返回布尔 + writeText/execCommand 调用参数 + 降级 textarea 真实携带文本

function stubSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', {
    value,
    configurable: true,
  })
}

function mockExecCommand(impl?: () => boolean): Mock {
  const fn = vi.fn(impl ?? (() => true))
  Object.defineProperty(document, 'execCommand', {
    value: fn,
    configurable: true,
    writable: true,
  })
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  stubSecureContext(true)
  delete (document as Partial<Document>).execCommand
  document.body.innerHTML = ''
})

describe('copyText', () => {
  it('安全上下文走 navigator.clipboard 并返回 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    stubSecureContext(true)
    // execCommand 返回 false：若误走降级链结果会变 false，证明本例走的是 API 路径
    mockExecCommand(() => false)

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('writeText 失败降级 execCommand，textarea 携带多行原文', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    stubSecureContext(true)
    const captured: string[] = []
    // execCommand 执行瞬间 textarea 仍在 DOM（finally 才移除），从中取值断言
    mockExecCommand(() => {
      const el = document.querySelector('textarea')
      captured.push(
        el instanceof HTMLTextAreaElement ? el.value : '<not textarea>',
      )
      return true
    })

    await expect(copyText('line1\nline2')).resolves.toBe(true)
    expect(captured).toEqual(['line1\nline2'])
  })

  it('非安全上下文（HTTP）不走 clipboard API 直接降级', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    stubSecureContext(false)
    const execCommand = mockExecCommand(() => true)

    await expect(copyText('text')).resolves.toBe(true)
    expect(writeText).not.toHaveBeenCalled()
    expect(execCommand).toHaveBeenCalledTimes(1)
  })

  it('clipboard 对象不存在时降级 execCommand', async () => {
    vi.stubGlobal('navigator', {})
    stubSecureContext(true)
    const execCommand = mockExecCommand(() => true)

    await expect(copyText('text')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledTimes(1)
  })

  it('execCommand 返回 false 时整体失败', async () => {
    vi.stubGlobal('navigator', {})
    stubSecureContext(true)
    mockExecCommand(() => false)

    await expect(copyText('text')).resolves.toBe(false)
  })

  it('execCommand 抛异常时返回 false 不向上抛', async () => {
    vi.stubGlobal('navigator', {})
    stubSecureContext(true)
    mockExecCommand(() => {
      throw new Error('not implemented')
    })

    await expect(copyText('text')).resolves.toBe(false)
  })

  it('降级路径结束后 textarea 从 DOM 移除', async () => {
    vi.stubGlobal('navigator', {})
    stubSecureContext(true)
    mockExecCommand(() => true)

    await copyText('cleanup check')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })

  it('空字符串直接返回 false 且不触碰剪贴板 API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    stubSecureContext(true)

    await expect(copyText('')).resolves.toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('非浏览器环境（无 window）返回 false 不抛错', async () => {
    vi.stubGlobal('window', undefined)

    await expect(copyText('text')).resolves.toBe(false)
  })
})
