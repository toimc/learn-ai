import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('mastra 实例静态构造（src/mastra/index.ts）', () => {
  it('缺 MASTRA_APP_MODEL：模块加载即抛指明该 env 的可读错误（启动失败）', async () => {
    vi.stubEnv('MASTRA_APP_MODEL', '')
    vi.resetModules()
    await expect(import('./index')).rejects.toThrow(/MASTRA_APP_MODEL/)
  })

  it('配齐 MASTRA_APP_MODEL：模块可加载并静态命名导出 mastra 实例', async () => {
    vi.stubEnv('MASTRA_APP_MODEL', 'deepseek/deepseek-chat')
    vi.resetModules()
    const mod = await import('./index')
    expect(mod.mastra).toBeDefined()
    expect(typeof mod.mastra.getAgent).toBe('function')
  })
})
