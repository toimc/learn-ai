import { describe, expect, it } from 'vitest'
import type { ThemedToken } from 'shiki/core'
import { tokensToHtml, escapeHtml } from './tokensToHtml'

describe('escapeHtml', () => {
  it('转义 & < >', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
  it('空字符串原样返回', () => {
    expect(escapeHtml('')).toBe('')
  })
  it('不含特殊字符原样返回', () => {
    expect(escapeHtml('const a = 1')).toBe('const a = 1')
  })
})

describe('tokensToHtml', () => {
  it('空数组返回空字符串', () => {
    expect(tokensToHtml([])).toBe('')
  })

  it('单 token 渲染为 <span> 包裹内容', () => {
    const tokens: ThemedToken[] = [{ content: 'const', offset: 0 }]
    const html = tokensToHtml(tokens)
    expect(html).toBe('<span>const</span>')
  })

  it('多 token 拼接为多个 span', () => {
    const tokens: ThemedToken[] = [
      { content: 'const', offset: 0 },
      { content: ' ', offset: 5 },
      { content: 'a', offset: 6 },
    ]
    const html = tokensToHtml(tokens)
    expect(html).toBe('<span>const</span><span> </span><span>a</span>')
  })

  it('带 color 的 token 输出内联 style', () => {
    const tokens: ThemedToken[] = [
      { content: 'const', offset: 0, color: '#ff79c6' },
    ]
    const html = tokensToHtml(tokens)
    expect(html).toContain('style="')
    expect(html).toContain('color:#ff79c6')
  })

  it('带 htmlStyle（双主题 CSS 变量）的 token 输出变量', () => {
    const tokens: ThemedToken[] = [
      {
        content: 'const',
        offset: 0,
        htmlStyle: {
          '--shiki-light': '#24292e',
          '--shiki-dark': '#e1e4e8',
        },
      },
    ]
    const html = tokensToHtml(tokens)
    expect(html).toContain('--shiki-light:#24292e')
    expect(html).toContain('--shiki-dark:#e1e4e8')
  })

  it('转义 token 内容中的 HTML 特殊字符', () => {
    const tokens: ThemedToken[] = [{ content: 'a < b', offset: 0 }]
    const html = tokensToHtml(tokens)
    expect(html).toContain('a &lt; b')
    expect(html).not.toContain('a < b')
  })

  it('htmlStyle 同时含 color 与变量时一并输出', () => {
    const tokens: ThemedToken[] = [
      {
        content: 'x',
        offset: 0,
        htmlStyle: {
          color: '#111',
          '--shiki-dark': '#eee',
        },
      },
    ]
    const html = tokensToHtml(tokens)
    expect(html).toContain('color:#111')
    expect(html).toContain('--shiki-dark:#eee')
  })

  it('fontStyle（italic）以 font-style 输出', () => {
    const tokens: ThemedToken[] = [{ content: 'x', offset: 0, fontStyle: 1 }]
    const html = tokensToHtml(tokens)
    expect(html).toContain('font-style:italic')
  })
})
