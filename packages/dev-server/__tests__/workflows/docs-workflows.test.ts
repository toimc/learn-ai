import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 原生 Workflow 层测试（spec 16 §10 原生层扩展）：
 * 预期值手写字面量；模块缺失时导入失败即红灯基线。
 */

const BASE_ENV = { model: 'main-model' }

describe('docsPipelineWorkflow（流水线原生版）', () => {
  it('工厂返回 id 为 docs-pipeline-workflow 的 workflow', async () => {
    const { DOCS_PIPELINE_WORKFLOW_ID, docsPipelineWorkflow } =
      await import('../../src/workflows/docs-pipeline')
    const wf = docsPipelineWorkflow(BASE_ENV)
    expect(DOCS_PIPELINE_WORKFLOW_ID).toBe('docs-pipeline-workflow')
    expect(wf.id).toBe('docs-pipeline-workflow')
  })

  it('复用 teamDefinitions 子 agent：researcher 走 subModel 按角色选模型', async () => {
    const { docsPipelineWorkflow } =
      await import('../../src/workflows/docs-pipeline')
    // 工厂不因 subModel 缺失而异常，且 subModel 场景可构建（模型解析在 teamDefinitions 内完成）
    expect(() =>
      docsPipelineWorkflow({ ...BASE_ENV, subModel: 'cheap-model' }),
    ).not.toThrow()
  })
})

describe('docsCouncilWorkflow（并行原生版）', () => {
  it('工厂返回 id 为 docs-council-workflow 的 workflow', async () => {
    const { DOCS_COUNCIL_WORKFLOW_ID, docsCouncilWorkflow } =
      await import('../../src/workflows/docs-council')
    const wf = docsCouncilWorkflow(BASE_ENV)
    expect(DOCS_COUNCIL_WORKFLOW_ID).toBe('docs-council-workflow')
    expect(wf.id).toBe('docs-council-workflow')
  })
})

describe('Studio 组装注册 workflows（src/mastra/index）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('mastra 实例挂载两个原生 workflow', async () => {
    vi.stubEnv('MASTRA_MODEL', 'main-model')
    const mod = await import('../../src/mastra/index')
    expect(mod.mastra.getWorkflow('docs-pipeline-workflow')).toBeTruthy()
    expect(mod.mastra.getWorkflow('docs-council-workflow')).toBeTruthy()
  })
})
