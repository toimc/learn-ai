import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hono } from 'hono'

const fakes = vi.hoisted(() => {
  const fakeAdapter = {
    async *chatStream() {},
    async chat() {
      return { content: '', model: 'x' }
    },
  }
  const created = vi.fn(async () => ({
    adapter: fakeAdapter,
    info: { name: 'Chat Agent', description: 'd', provider: 'mastra' },
    agent: { __marker: 'agent' },
  }))
  return { fakeAdapter, created }
})

vi.mock('@toimc/agents/mastra', () => ({
  // createMastraModel 是 async 工厂（内部动态加载 @mastra/core），mock 保持同形态
  createMastraModel: fakes.created,
}))

import { createMastraGateway } from '../../src/mastra/index'
import type { MastraAgentDefinition } from '../../src/mastra/index'

const chatAgent: MastraAgentDefinition = {
  id: 'chat-agent',
  name: 'Chat Agent',
  model: 'deepseek/deepseek-chat',
  instructions: '演示指令',
  tools: { getTimeTool: { __marker: 'time-tool' } },
  memory: vi.fn(() => ({ __marker: 'memory' })),
}

/** GET /api/models 返回 `{ models: ModelPublicInfo[] }`（routes/models.ts 现状） */
async function modelIds(app: Hono): Promise<string[]> {
  const res = await app.request('/api/models')
  const body = (await res.json()) as { models: Array<{ id: string }> }
  return body.models.map((m) => m.id)
}

// 共享 vi.fn 的调用计数不跨用例泄漏（对齐 mock-server register.test.ts 先例）
beforeEach(() => {
  vi.clearAllMocks()
})

describe('createMastraGateway', () => {
  it('agents 定义逐个注册为网关模型（/api/models 可见）', async () => {
    const { app, registry } = await createMastraGateway({ agents: [chatAgent] })
    expect(await modelIds(app)).toContain('chat-agent')
    // registry.get 返回 RegisteredModel 条目，adapter 才是注册的适配器实例
    expect(registry.get('chat-agent').adapter).toBe(fakes.fakeAdapter)
    expect(fakes.created).toHaveBeenCalledTimes(1)
  })

  it('无 agents 时为纯网关（models 数组路径保留）', async () => {
    const { app } = await createMastraGateway({
      models: [
        {
          id: 'mock-pro',
          provider: 'openai-compat',
          model: 'm',
          apiKey: 'k',
        },
      ],
    })
    expect(await modelIds(app)).toContain('mock-pro')
    expect(fakes.created).not.toHaveBeenCalled()
  })

  it('agent 构建失败时抛出含 agent id 的可读错误', async () => {
    fakes.created.mockRejectedValueOnce(new Error('缺 @mastra/core'))
    await expect(createMastraGateway({ agents: [chatAgent] })).rejects.toThrow(
      'chat-agent',
    )
    fakes.created.mockClear()
  })

  it('memory 工厂在注册时被调用一次', async () => {
    await createMastraGateway({ agents: [chatAgent] })
    expect(chatAgent.memory).toHaveBeenCalledTimes(1)
  })
})
