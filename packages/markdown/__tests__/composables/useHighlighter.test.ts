import { describe, expect, it } from 'vitest'
import {
  useHighlighter,
  normalizeLang,
  SUPPORTED_LANGS,
} from '../../src/composables/useHighlighter'

describe('useHighlighter', () => {
  it('返回可用的 highlighter 单例', async () => {
    const hl = await useHighlighter()
    expect(hl).toBeTruthy()
    // 应能列出已加载语言
    expect(hl.getLoadedLanguages()).toContain('javascript')
    expect(hl.getLoadedLanguages()).toContain('typescript')
    expect(hl.getLoadedLanguages()).toContain('vue')
  })

  it('codeToTokens 产出 token 数组（javascript / github-light）', async () => {
    const hl = await useHighlighter()
    const result = hl.codeToTokens('const a = 1', {
      lang: 'javascript',
      theme: 'github-light',
    })
    // 第一行的 token 不为空
    expect(result.tokens.length).toBeGreaterThan(0)
    const firstLine = result.tokens[0]
    expect(firstLine.length).toBeGreaterThan(0)
    // token 内容拼回应包含源码
    const reconstructed = firstLine.map((t) => t.content).join('')
    expect(reconstructed).toBe('const a = 1')
  })

  it('单例身份：多次调用返回同一实例', async () => {
    const a = await useHighlighter()
    const b = await useHighlighter()
    expect(a).toBe(b)
  })

  it('双主题同时加载（light + dark）', async () => {
    const hl = await useHighlighter()
    expect(hl.getLoadedThemes()).toContain('github-light')
    expect(hl.getLoadedThemes()).toContain('github-dark')
  })

  it('FR-2.5 全部支持语言已加载', async () => {
    const hl = await useHighlighter()
    const loaded = hl.getLoadedLanguages()
    for (const lang of SUPPORTED_LANGS) {
      expect(loaded, `语言 ${lang} 应已加载`).toContain(lang)
    }
  })
})

describe('normalizeLang', () => {
  it('把别名归一到规范语言名', () => {
    expect(normalizeLang('js')).toBe('javascript')
    expect(normalizeLang('ts')).toBe('typescript')
    expect(normalizeLang('py')).toBe('python')
    expect(normalizeLang('sh')).toBe('bash')
    expect(normalizeLang('shell')).toBe('bash')
    expect(normalizeLang('md')).toBe('markdown')
    expect(normalizeLang('yml')).toBe('yaml')
    // 已规范的不变
    expect(normalizeLang('javascript')).toBe('javascript')
    expect(normalizeLang('vue')).toBe('vue')
  })

  it('未知语言原样返回（由调用方决定降级）', () => {
    expect(normalizeLang('brainfuck')).toBe('brainfuck')
  })

  it('大小写不敏感', () => {
    expect(normalizeLang('JS')).toBe('javascript')
    expect(normalizeLang('Python')).toBe('python')
  })
})
