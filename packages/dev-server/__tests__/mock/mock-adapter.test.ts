import { describe, it, expect } from 'vitest'
import { createMockAdapter } from '../../src/mock/mock-adapter'
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

describe('多模态 parts 降级（18-02：mock 线无视觉能力的可预期行为）', () => {
  const multimodalRequest = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '上海天气如何，用工具查一下' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ' },
          },
        ],
      },
    ],
    passthrough: { speed: 0 },
  } as unknown as ChatRequest

  it('提取 text part 用于剧本匹配：图片随文发送仍命中工具剧本', async () => {
    const chunks = await collect(multimodalRequest)
    const toolCall = chunks.find((c) => c.type === 'tool_call')
    expect(
      (toolCall?.metadata as { toolName?: string } | undefined)?.toolName,
    ).toBe('get_weather')
  })

  it('usage 估算按提取后的文本（13 字全 CJK），不把 parts 数组序列化算进去', async () => {
    const chunks = await collect(multimodalRequest)
    const done = chunks.at(-1)
    expect((done?.metadata?.usage as { inputTokens: number }).inputTokens).toBe(
      13,
    )
  })

  it('纯图片消息（无 text part）降级为默认剧本，不崩', async () => {
    const chunks = await collect({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,A' },
            },
          ],
        },
      ],
      passthrough: { speed: 0 },
    } as unknown as ChatRequest)
    expect(chunks.at(-1)?.type).toBe('done')
    expect(chunks.some((c) => c.type === 'text')).toBe(true)
  })

  it('content 为 null 等非法形态时按空输入处理（回归防御不丢）', async () => {
    const chunks = await collect({
      messages: [{ role: 'user', content: null }],
      passthrough: { speed: 0 },
    } as unknown as ChatRequest)
    expect(chunks.at(-1)?.type).toBe('done')
  })
})
