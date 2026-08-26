import { describe, it, expect } from 'vitest'
import { estimateTokens } from './estimate-tokens'

describe('estimateTokens', () => {
  it('空串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('纯中文按 1:1 计', () => {
    // 预期值手写：「你好世界前端开发课程！」= 10 汉字 + 1 全角标点 = 11 CJK 字符 = 11 token
    expect(estimateTokens('你好世界前端开发课程！')).toBe(11)
  })

  it('纯英文按 4 字符 1 token 向上取整', () => {
    // 9 个 ASCII 字符 = ceil(9/4) = 3
    expect(estimateTokens('hello abc')).toBe(3)
  })

  it('中英混合分别计费后求和', () => {
    // 2 个汉字 + 8 个 ASCII = 2 + ceil(8/4) = 2 + 2 = 4
    expect(estimateTokens('你好ab hello')).toBe(4)
  })
})
