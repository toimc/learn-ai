import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MastraEnv } from '../../src/env'

/**
 * workflow 注册表测试：三个 workflow 工厂的单一事实来源，
 * Studio 宿主（src/mastra/index）经注册表组装不再重复装配。
 * mock 掉真实 LibSQL 连接（对齐 __tests__/agents/orchestrator-agent.test.ts 的 stubEnv 模式）。
 */

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

describe('buildWorkflowRegistry 注册表', () => {
  it('含三个 workflow 项，id 与各模块常量一致', async () => {
    const { buildWorkflowRegistry } =
      await import('../../src/workflows/registry')
    const { DOCS_PIPELINE_WORKFLOW_ID } =
      await import('../../src/workflows/docs-pipeline')
    const { DOCS_COUNCIL_WORKFLOW_ID } =
      await import('../../src/workflows/docs-council')
    const { DOCS_SUPERVISOR_WORKFLOW_ID } =
      await import('../../src/workflows/docs-supervisor')

    const ids = buildWorkflowRegistry(BASE_ENV).map((entry) => entry.id)
    expect(ids).toEqual([
      DOCS_PIPELINE_WORKFLOW_ID,
      DOCS_COUNCIL_WORKFLOW_ID,
      DOCS_SUPERVISOR_WORKFLOW_ID,
    ])
    expect(ids).toEqual([
      'docs-pipeline-workflow',
      'docs-council-workflow',
      'docs-supervisor-workflow',
    ])
  })

  it('每项 description 来自模块常量（非空中文描述）', async () => {
    const { buildWorkflowRegistry } =
      await import('../../src/workflows/registry')
    const { DOCS_PIPELINE_WORKFLOW_DESCRIPTION } =
      await import('../../src/workflows/docs-pipeline')

    const registry = buildWorkflowRegistry(BASE_ENV)
    expect(registry[0]?.description).toBe(DOCS_PIPELINE_WORKFLOW_DESCRIPTION)
    for (const entry of registry) {
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })

  it('create() 构建的 workflow 实例 id 与注册表 id 一致', async () => {
    const { buildWorkflowRegistry } =
      await import('../../src/workflows/registry')
    for (const entry of buildWorkflowRegistry(BASE_ENV)) {
      expect(entry.create().id).toBe(entry.id)
    }
  })
})

describe('Studio 宿主组装（src/mastra/index）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('三个原生 workflow 经注册表全部挂进 Mastra 实例', async () => {
    vi.stubEnv('MASTRA_MODEL', 'main-model')
    const mod = await import('../../src/mastra/index')
    // getWorkflow 取不到实例时 .id 访问直接抛错（强于真值断言）
    expect(mod.mastra.getWorkflow('docs-pipeline-workflow').id).toBe(
      'docs-pipeline-workflow',
    )
    expect(mod.mastra.getWorkflow('docs-council-workflow').id).toBe(
      'docs-council-workflow',
    )
    expect(mod.mastra.getWorkflow('docs-supervisor-workflow').id).toBe(
      'docs-supervisor-workflow',
    )
  })
})
