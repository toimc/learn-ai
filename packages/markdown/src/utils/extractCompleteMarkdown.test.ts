import { describe, expect, it } from 'vitest'
import { extractCompleteMarkdown } from './extractCompleteMarkdown'

describe('extractCompleteMarkdown', () => {
  it('正常成对代码块原样返回', () => {
    const input = '```js\nconst a = 1\n```\n文本'
    expect(extractCompleteMarkdown(input)).toBe(input)
  })
  it('未闭合代码块截到最后一个围栏前', () => {
    const input = '前文\n```js\nconst a = 1\n未闭合'
    expect(extractCompleteMarkdown(input)).toBe('前文')
  })
  it('未闭合块级公式 $$ 截断', () => {
    const input = '文本\n$$\na = b\n未闭合'
    expect(extractCompleteMarkdown(input)).toBe('文本\n')
  })
  it('正常成对公式原样返回', () => {
    const input = 'a $$x^2$$ b'
    expect(extractCompleteMarkdown(input)).toBe(input)
  })
  it('空字符串返回空', () => {
    expect(extractCompleteMarkdown('')).toBe('')
  })
  it('波浪号围栏未闭合也截断', () => {
    expect(extractCompleteMarkdown('前文\n~~~\ncode\n未闭合')).toBe('前文')
  })
  it('行内文本里的反引号不当围栏', () => {
    const input = 'see ``` below for code'
    expect(extractCompleteMarkdown(input)).toBe(input)
  })
  it('代码块内的 $$ 不被当作公式', () => {
    const input = '```\n$$a$$\n```\n文本'
    expect(extractCompleteMarkdown(input)).toBe(input)
  })
  it('四反引号外层包裹内层三反引号不误判', () => {
    // 外层 4 反引号开，内层 3 反引号不应闭合外层；外层未闭合 → 截到外层前
    const input = '前文\n````\n```\ncode\n未闭合'
    expect(extractCompleteMarkdown(input)).toBe('前文')
  })
})
