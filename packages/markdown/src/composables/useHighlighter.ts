/**
 * Shiki 高亮器单例（FR-2.2 / FR-2.5 / FR-2.7）
 *
 * 设计要点：
 * - 模块级懒加载 `Promise<Highlighter>`，整个应用只初始化一次（单例身份）。
 * - 使用 `shiki/core` 的 `createHighlighterCore` + `createJavaScriptRegexEngine`
 *   （纯 JS 正则引擎，无 wasm，浏览器零额外加载步骤）。
 * - 语法按需动态导入 `shiki/dist/langs/*.mjs`，仅打包 FR-2.5 要求的语言集合。
 * - 双主题 `github-light` / `github-dark` 一次性加载（FR-2.7），后续切换主题无需重新高亮。
 */
import type { HighlighterCore } from 'shiki/core'

// 引擎与核心工厂：来自 shiki 的细粒度入口
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

/** FR-2.5：支持的规范语言名集合 */
export const SUPPORTED_LANGS = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'vue',
  'json',
  'bash',
  'html',
  'css',
  'scss',
  'python',
  'go',
  'rust',
  'markdown',
  'yaml',
  'sql',
] as const

/** 语言别名 → 规范名（FR-2.5 归一化） */
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  md: 'markdown',
  yml: 'yaml',
  text: 'text',
  plaintext: 'text',
}

/** 把任意语言标识归一到规范名（大小写不敏感）。未知语言原样返回，由调用方降级。 */
export function normalizeLang(lang: string | undefined | null): string {
  if (!lang) return 'text'
  const lower = lang.toLowerCase().trim()
  return LANG_ALIASES[lower] ?? lower
}

/** 是否为已加载支持的语言（normalize 之后） */
export function isSupportedLang(lang: string): boolean {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang)
}

// 单例缓存
let highlighterPromise: Promise<HighlighterCore> | null = null

/**
 * 获取（懒加载）Shiki 高亮器单例。
 *
 * 首次调用触发核心 + JS 引擎 + 双主题 + 全部支持语言的初始化；
 * 后续调用返回同一个 Promise（单例身份）。
 */
export function useHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import('shiki/dist/themes/github-light.mjs'),
        import('shiki/dist/themes/github-dark.mjs'),
      ],
      langs: [
        import('shiki/dist/langs/javascript.mjs'),
        import('shiki/dist/langs/typescript.mjs'),
        import('shiki/dist/langs/jsx.mjs'),
        import('shiki/dist/langs/tsx.mjs'),
        import('shiki/dist/langs/vue.mjs'),
        import('shiki/dist/langs/json.mjs'),
        import('shiki/dist/langs/bash.mjs'),
        import('shiki/dist/langs/html.mjs'),
        import('shiki/dist/langs/css.mjs'),
        import('shiki/dist/langs/scss.mjs'),
        import('shiki/dist/langs/python.mjs'),
        import('shiki/dist/langs/go.mjs'),
        import('shiki/dist/langs/rust.mjs'),
        import('shiki/dist/langs/markdown.mjs'),
        import('shiki/dist/langs/yaml.mjs'),
        import('shiki/dist/langs/sql.mjs'),
      ],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

/**
 * 仅供测试使用：重置单例，便于隔离测试。
 * 生产代码不要调用。
 */
export function __resetHighlighterForTest(): void {
  highlighterPromise = null
}
