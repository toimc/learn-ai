import { describe, it, expect } from 'vitest'
import { createMockAdapter } from './mock-adapter'
import type { ChatRequest } from '@toimc/agents'

async function collect(request: ChatRequest) {
  const chunks = []
  for await (const chunk of createMockAdapter('pro').chatStream(request)) {
    chunks.push(chunk)
  }
  return chunks
}

describe('mock adapter usage', () => {
  it('剧本收尾 done 帧携带 usage，inputTokens 为请求消息 token 之和', async () => {
    const chunks = await collect({
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: 'x' },
        { role: 'user', content: '功能演示' },
      ],
      passthrough: { speed: 0 },
    } as ChatRequest)
    const done = chunks.at(-1)
    expect(done?.type).toBe('done')
    // estimateTokens('你好')=2, ('x')=1, ('功能演示')=4 → 7
    expect(done?.metadata?.usage).toEqual({
      inputTokens: 7,
      outputTokens: expect.any(Number),
    })
  })

  it('outputTokens 为正数（剧本文本估算）', async () => {
    const chunks = await collect({
      messages: [{ role: 'user', content: 'hello' }],
      passthrough: { speed: 0 },
    } as ChatRequest)
    const usage = chunks.at(-1)?.metadata?.usage as { outputTokens: number }
    expect(usage.outputTokens).toBeGreaterThan(0)
  })
})
