import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Supervisor 原生 Workflow 测试（spec 16 §10 扩展）：
 * 主 agent 每轮结构化决策调哪个子 agent，dountil 循环到任务完成。
 * 预期值手写字面量；模块缺失时导入失败即红灯基线。
 */

const BASE_ENV = { model: 'main-model' }

describe('docsSupervisorWorkflow（主管循环原生版）', () => {
  it('工厂返回 id 为 docs-supervisor-workflow 的 workflow', async () => {
    const { DOCS_SUPERVISOR_WORKFLOW_ID, docsSupervisorWorkflow } =
      await import('../../src/workflows/docs-supervisor')
    const wf = docsSupervisorWorkflow(BASE_ENV)
    expect(DOCS_SUPERVISOR_WORKFLOW_ID).toBe('docs-supervisor-workflow')
    expect(wf.id).toBe('docs-supervisor-workflow')
  })

  it('subModel 场景可构建（researcher 走便宜模型不受影响）', async () => {
    const { docsSupervisorWorkflow } =
      await import('../../src/workflows/docs-supervisor')
    expect(() =>
      docsSupervisorWorkflow({ ...BASE_ENV, subModel: 'cheap-model' }),
    ).not.toThrow()
  })
})

describe('Studio 注册 supervisor workflow（src/mastra/index）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('mastra 实例挂载 docs-supervisor-workflow', async () => {
    vi.stubEnv('MASTRA_MODEL', 'main-model')
    const mod = await import('../../src/mastra/index')
    expect(mod.mastra.getWorkflow('docs-supervisor-workflow')).toBeTruthy()
  })
})
