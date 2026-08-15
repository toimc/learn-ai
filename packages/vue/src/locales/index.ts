import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export type { MessageSchema } from './zh-CN'

/** 内置语言；宿主可 aiChatI18n.global.setLocaleMessage() 注入更多 */
export type AiChatLocale = 'zh-CN' | 'en-US'
/** LanguageToggle 的语言选项 */
export type LocaleOption = { value: string; label: string }

const STORAGE_KEY = 'ai-chat-locale'
const BUILTIN_LOCALES: readonly string[] = ['zh-CN', 'en-US']

/**
 * 库内模块级单例（与 useTheme 同模式）：
 * - 宿主零配置即用，不要求 app.use
 * - 与宿主自有 vue-i18n 实例天然隔离
 * - SSR 下 locale 跨请求共享，静态文档站（VitePress）可接受
 */
export const aiChatI18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
  // missingWarn/fallbackWarn 走 vue-i18n 默认（dev 告警、prod 静默）
})

/** composer：组件内 `const { t } = aiChatI18n.global` 解构安全 */
export const composer = aiChatI18n.global

export function getInitialLocale(): AiChatLocale {
  if (typeof window === 'undefined') return 'zh-CN'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && BUILTIN_LOCALES.includes(saved)) return saved as AiChatLocale
  const nav = navigator.language
  if (nav.startsWith('en')) return 'en-US'
  return 'zh-CN'
}

/** 切换语言：写 locale + 同步 <html lang> + 持久化（官方 setI18nLanguage 模式） */
export function setAiChatLocale(
  locale: string,
  opts: { persist?: boolean } = {},
) {
  const { persist = true } = opts
  composer.locale.value = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
  if (persist && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }
}

// 初始化（读取持久化/浏览器语言；不再回写 localStorage）
setAiChatLocale(getInitialLocale(), { persist: false })
