import { describe, it, expect, beforeEach } from 'vitest'
import zhCN from './zh-CN'
import enUS from './en-US'
import { aiChatI18n, setAiChatLocale, getInitialLocale } from './index'

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flattenKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('字典结构', () => {
  it('zh-CN 与 en-US 的 key 树完全一致', () => {
    expect(flattenKeys(enUS).sort()).toEqual(flattenKeys(zhCN).sort())
  })

  it('所有值均为非空字符串', () => {
    for (const k of flattenKeys(zhCN)) expect(typeof k).toBe('string')
    // 逐值断言非空
    const check = (o: Record<string, unknown>) => {
      for (const v of Object.values(o)) {
        if (typeof v === 'object' && v !== null)
          check(v as Record<string, unknown>)
        else expect((v as string).length).toBeGreaterThan(0)
      }
    }
    check(zhCN)
    check(enUS)
  })
})

describe('t() 输出', () => {
  beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

  it('中文：t("shared.close") === "关闭"', () => {
    expect(aiChatI18n.global.t('shared.close')).toBe('关闭')
  })

  it('切换英文后输出英文', () => {
    setAiChatLocale('en-US', { persist: false })
    expect(aiChatI18n.global.t('shared.close')).toBe('Close')
    expect(aiChatI18n.global.t('promptInput.placeholder')).toBe(
      'Send a message to AI Chat UI...',
    )
  })

  it('切换中文后恢复中文', () => {
    setAiChatLocale('en-US', { persist: false })
    setAiChatLocale('zh-CN', { persist: false })
    expect(aiChatI18n.global.t('conversation.emptyTitle')).toBe(
      '有什么可以帮你的？',
    )
  })
})

describe('setAiChatLocale', () => {
  it('同步 document.documentElement.lang', () => {
    setAiChatLocale('en-US', { persist: false })
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('persist=false 不写 localStorage', () => {
    localStorage.removeItem('ai-chat-locale')
    setAiChatLocale('en-US', { persist: false })
    expect(localStorage.getItem('ai-chat-locale')).toBeNull()
  })

  it('默认持久化', () => {
    setAiChatLocale('en-US')
    expect(localStorage.getItem('ai-chat-locale')).toBe('en-US')
    localStorage.removeItem('ai-chat-locale')
  })
})

describe('getInitialLocale', () => {
  // jsdom 的 navigator.language 默认 en-US，无法覆盖「浏览器语言非英文」分支，
  // 改为验证「读存储优先」语义（jsdom 下无存储时会跟随浏览器语言返回 en-US）
  it('读 localStorage 优先：存 zh-CN 返回 zh-CN', () => {
    localStorage.setItem('ai-chat-locale', 'zh-CN')
    expect(getInitialLocale()).toBe('zh-CN')
  })

  it('读 localStorage 优先：存 en-US 返回 en-US', () => {
    localStorage.setItem('ai-chat-locale', 'en-US')
    expect(getInitialLocale()).toBe('en-US')
  })

  it('无存储时跟随浏览器语言（jsdom 为 en-US）', () => {
    localStorage.removeItem('ai-chat-locale')
    expect(getInitialLocale()).toBe('en-US')
  })
})
