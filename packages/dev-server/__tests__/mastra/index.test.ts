import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCompositeStorage } from '../../src/memory'

// mock 掉真实 LibSQL 连接：本文件只关心"实例级 storage 来自 createCompositeStorage 工厂"这条接线，
// 不在测试里碰文件系统；createMemory 返回 undefined 使 Agent 走无记忆路径，构造安全
vi.mock('../../src/memory', () => ({
  createMemory: () => undefined,
  // Mastra 构造时会调 storage.__setLogger 挂日志器，mock 对象需带上这个方法
  // createCompositeStorage 为 async（DuckDB 观测域），mock 返回 Promise
  createCompositeStorage: vi.fn(async () => ({
    marker: 'composite-file-storage',
    __setLogger: () => {},
    getStore: async () => undefined,
  })),
}))

describe('src/mastra 静态导出（Studio 入口）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // 每个用例都动态 import 整条 @mastra/core 模块链（resetModules 后无缓存可复用），
  // 全量并行高负载下冷加载可超默认 5s：统一放宽该文件的用例超时预算
  const COLD_IMPORT_TIMEOUT = 30_000

  it(
    '缺 MASTRA_MODEL 时 import 即抛可读错误（Studio 需要真实模型）',
    async () => {
      vi.stubEnv('MASTRA_MODEL', '')
      await expect(import('../../src/mastra/index')).rejects.toThrow(
        'MASTRA_MODEL',
      )
    },
    COLD_IMPORT_TIMEOUT,
  )

  it(
    '配置 env 后导出含 chat-agent 的 Mastra 实例',
    async () => {
      vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
      vi.stubEnv('CONTEXT7_API_KEY', '')
      const mod = await import('../../src/mastra/index')
      // @mastra/core 1.60 无 getAgents()，用 getAgent 按名取实例并断言构造时的 name
      expect(mod.mastra.getAgent('chat-agent').name).toBe('Chat Agent')
    },
    COLD_IMPORT_TIMEOUT,
  )

  it(
    '注册表 agent 全量挂载：docs-agent 也在 Studio 可见',
    async () => {
      vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
      vi.stubEnv('CONTEXT7_API_KEY', '')
      const mod = await import('../../src/mastra/index')
      expect(mod.mastra.getAgent('docs-agent').name).toBe('组件库助手')
    },
    COLD_IMPORT_TIMEOUT,
  )

  it(
    '实例级 storage 来自 createCompositeStorage 工厂（会话主库 + observability 域分库）',
    async () => {
      vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
      vi.stubEnv('CONTEXT7_API_KEY', '')
      const mod = await import('../../src/mastra/index')
      expect(createCompositeStorage).toHaveBeenCalled()
      expect(mod.mastra.getStorage()).toMatchObject({
        marker: 'composite-file-storage',
      })
    },
    COLD_IMPORT_TIMEOUT,
  )

  it(
    '宿主侧 MCP server 注册进 Mastra 实例（mastra dev 起 /mcp 端点）',
    async () => {
      vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
      vi.stubEnv('CONTEXT7_API_KEY', '')
      const mod = await import('../../src/mastra/index')
      expect(Object.keys(mod.mastra.listMCPServers() ?? {})).toContain(
        'weather-mcp-server',
      )
    },
    COLD_IMPORT_TIMEOUT,
  )
})
