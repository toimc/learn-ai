import { describe, expect, it } from 'vitest'
import { extractCompleteMarkdown } from './extractCompleteMarkdown'

describe('extractCompleteMarkdown', () => {
  it('正常成对代码块原样返回', () => {
    const input = '```js\nconst a = 1\n```\n文本'
    expect(extractCompleteMarkdown(input)).toBe(input)
  })
  it('未闭合代码块截到最后一个围栏前', () => {
    const input = '前文\n```js\nconst a = 1\n未闭合'
    expect(extractCompleteMarkdown(input)).toBe('前文\n')
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
})
