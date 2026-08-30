import { describe, expect, it } from 'vitest'
import { loadContext7Tools } from '../../src/mcp/context7'

describe('loadContext7Tools 门控', () => {
  it('纯 mock 模式（无 mastra）返回空对象，不发起连接', async () => {
    expect(
      await loadContext7Tools({
        port: 8787,
        mastra: null,
        embedding: null,
        observability: false,
      }),
    ).toEqual({})
  })

  it('mastra 启用但 CONTEXT7_API_KEY 缺失时返回空对象，不发起连接', async () => {
    expect(
      await loadContext7Tools({
        port: 8787,
        mastra: { model: 'deepseek/deepseek-chat' },
        embedding: null,
        observability: false,
      }),
    ).toEqual({})
  })
})
