import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MastraEnv } from '../../src/env'

// Studio 装配测试动态 import src/mastra/index：mock 掉真实 LibSQL 连接，
// createMemory 返回 undefined 使 chat/docs agent 走无记忆路径（对齐 __tests__/mastra/index.test.ts）
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

const BASE_ENV: MastraEnv = { model: 'main-model' }
const SUB_ENV: MastraEnv = { model: 'main-model', subModel: 'sub-model' }

describe('buildAgentDefinitions 注册 orchestrator', () => {
  it('注册表含 orchestrator-agent，且不挤掉既有 agent', async () => {
    const { buildAgentDefinitions } = await import('../../src/agents/index')
    const ids = buildAgentDefinitions(BASE_ENV).map((d) => d.id)
    expect(ids).toContain('chat-agent')
    expect(ids).toContain('docs-agent')
    expect(ids).toContain('orchestrator-agent')
  })
})

describe('teamDefinitions 子 agent 定义', () => {
  it('返回三个定义：id 与中文名符合 spec 16 §3.1', async () => {
    const { teamDefinitions } = await import('../../src/orchestration/children')
    const defs = teamDefinitions(BASE_ENV)
    expect(defs.map((d) => d.id)).toEqual([
      'researcher-agent',
      'writer-agent',
      'reviewer-agent',
    ])
    expect(defs.map((d) => d.name)).toEqual(['检索员', '起草员', '审查员'])
  })

  it('工具持有：仅 researcher 挂 searchDocsTool，writer/reviewer 无工具', async () => {
    const { teamDefinitions } = await import('../../src/orchestration/children')
    const [researcher, writer, reviewer] = teamDefinitions(BASE_ENV)
    expect(Object.keys(researcher.tools ?? {})).toEqual(['searchDocsTool'])
    expect(writer.tools).toBeUndefined()
    expect(reviewer.tools).toBeUndefined()
  })

  it('按角色选模型：配 subModel 时 researcher 用之，writer/reviewer 仍用主模型', async () => {
    const { teamDefinitions } = await import('../../src/orchestration/children')
    const [researcher, writer, reviewer] = teamDefinitions(SUB_ENV)
    expect(researcher.model).toBe('sub-model')
    expect(writer.model).toBe('main-model')
    expect(reviewer.model).toBe('main-model')
  })

  it('未配 subModel 时三个子 agent 全用主模型', async () => {
    const { teamDefinitions } = await import('../../src/orchestration/children')
    for (const def of teamDefinitions(BASE_ENV)) {
      expect(def.model).toBe('main-model')
    }
  })

  it('reviewer instructions 写入首行 [pass]/[revise] 输出契约', async () => {
    const { teamDefinitions } = await import('../../src/orchestration/children')
    const [, , reviewer] = teamDefinitions(BASE_ENV)
    const instructions = reviewer.instructions ?? ''
    expect(instructions).toContain('[pass]')
    expect(instructions).toContain('[revise]')
  })
})

describe('orchestratorAgentDefinition', () => {
  it('id/name 符合 spec 16 §3.1，不配 memory', async () => {
    const { orchestratorAgentDefinition, ORCHESTRATOR_AGENT_ID } =
      await import('../../src/agents/orchestrator-agent')
    const def = orchestratorAgentDefinition(BASE_ENV)
    expect(def.id).toBe(ORCHESTRATOR_AGENT_ID)
    expect(def.id).toBe('orchestrator-agent')
    expect(def.name).toBe('多 Agent 编排助手')
    expect(def.memory).toBeUndefined()
  })

  it('instructions 含三条精确指令协议字符串与自行判断规则（spec 16 §3.4）', async () => {
    const { orchestratorAgentDefinition } =
      await import('../../src/agents/orchestrator-agent')
    const instructions =
      orchestratorAgentDefinition(BASE_ENV).instructions ?? ''
    expect(instructions).toContain('本次使用委托模式编排任务')
    expect(instructions).toContain('本次使用并行模式编排任务')
    expect(instructions).toContain('本次使用流水线模式编排任务')
    expect(instructions).toContain('orchestrate')
    expect(instructions).toContain('delegate')
    expect(instructions).toContain('parallel')
    expect(instructions).toContain('pipeline')
  })

  it('职责边界：不自己检索/起草、不重写子 agent 产出', async () => {
    const { orchestratorAgentDefinition } =
      await import('../../src/agents/orchestrator-agent')
    const instructions =
      orchestratorAgentDefinition(BASE_ENV).instructions ?? ''
    expect(instructions).toContain('不检索')
    expect(instructions).toContain('不重写')
  })

  it('工具 key 为 orchestrateTool，wire 工具名为 orchestrate（对齐 get_weather 模式）', async () => {
    const { orchestratorAgentDefinition } =
      await import('../../src/agents/orchestrator-agent')
    const def = orchestratorAgentDefinition(BASE_ENV)
    expect(Object.keys(def.tools ?? {})).toEqual(['orchestrateTool'])
    const tool = def.tools?.orchestrateTool as { id: string }
    expect(tool.id).toBe('orchestrate')
  })
})

describe('Studio 组装（src/mastra/index）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('orchestrator 与三个子 agent 全部挂进 Mastra 实例', async () => {
    vi.stubEnv('MASTRA_MODEL', 'main-model')
    const mod = await import('../../src/mastra/index')
    expect(mod.mastra.getAgent('orchestrator-agent').name).toBe(
      '多 Agent 编排助手',
    )
    expect(mod.mastra.getAgent('researcher-agent').name).toBe('检索员')
    expect(mod.mastra.getAgent('writer-agent').name).toBe('起草员')
    expect(mod.mastra.getAgent('reviewer-agent').name).toBe('审查员')
  })
})
