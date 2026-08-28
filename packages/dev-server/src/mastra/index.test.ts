import { afterEach, describe, expect, it, vi } from 'vitest'

describe('src/mastra 静态导出（Studio 入口）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('缺 MASTRA_MODEL 时 import 即抛可读错误（Studio 需要真实模型）', async () => {
    vi.stubEnv('MASTRA_MODEL', '')
    await expect(import('./index')).rejects.toThrow('MASTRA_MODEL')
  })

  it('配置 env 后导出含 chat-agent 的 Mastra 实例', async () => {
    vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
    const mod = await import('./index')
    // @mastra/core 1.60 无 getAgents()，用 getAgent 按名取实例并断言构造时的 name
    expect(mod.mastra.getAgent('chat-agent').name).toBe('Chat Agent')
  })
})
