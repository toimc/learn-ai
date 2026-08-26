import { describe, it, expect } from 'vitest'
import { truncateContext } from './context-window'
import type { Message } from '../types'

function msg(id: string, role: Message['role'], content: string): Message {
  return { id, role, content, createdAt: new Date() }
}

// 固定估算器：让断言值可用字面量手写（content 长度即 token 数）
const len = (text: string) => text.length

describe('truncateContext', () => {
  it('maxTokens 空/0/负 不截断原样返回', () => {
    const ms = [msg('a', 'user', 'x'.repeat(100)), msg('b', 'assistant', 'y')]
    expect(truncateContext(ms, undefined, len).messages).toHaveLength(2)
    expect(truncateContext(ms, 0, len).truncatedCount).toBe(0)
    expect(truncateContext(ms, -5, len).messages).toHaveLength(2)
  })

  it('窗口内消息原样保留（恰好等于预算）', () => {
    const ms = [msg('a', 'user', 'xxxx'), msg('b', 'assistant', 'yyyy')]
    const r = truncateContext(ms, 8, len)
    expect(r.messages.map((m) => m.id)).toEqual(['a', 'b'])
    expect(r.truncatedCount).toBe(0)
  })

  it('超预算从最旧丢弃，保留最新窗口', () => {
    // 预算 10：从尾往头累加 c(4)+b(4)=8 再加 a(4)=12 超出 → a 被截
    const ms = [
      msg('a', 'user', 'xxxx'),
      msg('b', 'assistant', 'xxxx'),
      msg('c', 'user', 'xxxx'),
    ]
    const r = truncateContext(ms, 10, len)
    expect(r.messages.map((m) => m.id)).toEqual(['b', 'c'])
    expect(r.truncatedCount).toBe(1)
  })

  it('首条 system 消息始终保留（token 计入预算）', () => {
    // 预算 10：从尾累加 c(4)=4、b(4)=8、a(4)=12 超出 → 截 a；[sys,b,c]=10 恰好不超
    const ms = [
      msg('sys', 'system', 'xx'),
      msg('a', 'user', 'xxxx'),
      msg('b', 'assistant', 'xxxx'),
      msg('c', 'user', 'xxxx'),
    ]
    const r = truncateContext(ms, 10, len)
    expect(r.messages.map((m) => m.id)).toEqual(['sys', 'b', 'c'])
    expect(r.truncatedCount).toBe(1)
  })

  it('metadata.tokenCount 优先于估算器（真实 usage 校准）', () => {
    const calibrated: Message = {
      ...msg('a', 'user', 'x'.repeat(100)),
      metadata: { tokenCount: 3 },
    }
    const b = msg('b', 'assistant', 'xx')
    const r = truncateContext([calibrated, b], 5, len)
    expect(r.messages).toHaveLength(2)
    expect(r.truncatedCount).toBe(0)
  })

  it('空数组安全返回', () => {
    const r = truncateContext([], 100, len)
    expect(r.messages).toHaveLength(0)
    expect(r.truncatedCount).toBe(0)
  })
})
