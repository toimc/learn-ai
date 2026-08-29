import type { AnyWorkflow } from '@mastra/core/workflows'
import type { MastraEnv } from '../env'
import {
  DOCS_COUNCIL_WORKFLOW_DESCRIPTION,
  DOCS_COUNCIL_WORKFLOW_ID,
  docsCouncilWorkflow,
} from './docs-council'
import {
  DOCS_PIPELINE_WORKFLOW_DESCRIPTION,
  DOCS_PIPELINE_WORKFLOW_ID,
  docsPipelineWorkflow,
} from './docs-pipeline'
import {
  DOCS_SUPERVISOR_WORKFLOW_DESCRIPTION,
  DOCS_SUPERVISOR_WORKFLOW_ID,
  docsSupervisorWorkflow,
} from './docs-supervisor'

/** 注册表项：id/description 来自各 workflow 模块常量，create 惰性构建实例 */
export interface WorkflowRegistryEntry {
  id: string
  description: string
  create: () => AnyWorkflow
}

/**
 * 三个原生 workflow 工厂的单一事实来源：Studio 宿主（src/mastra/index）与
 * HTTP 路由（src/routes/workflows）都从这里取清单，新增 workflow = 一个工厂
 * + 注册表一行。构建实例是纯同步对象装配（不触网），create 保持惰性以便
 * GET 列表只读常量不装配 agent。
 */
export function buildWorkflowRegistry(env: MastraEnv): WorkflowRegistryEntry[] {
  return [
    {
      id: DOCS_PIPELINE_WORKFLOW_ID,
      description: DOCS_PIPELINE_WORKFLOW_DESCRIPTION,
      create: () => docsPipelineWorkflow(env),
    },
    {
      id: DOCS_COUNCIL_WORKFLOW_ID,
      description: DOCS_COUNCIL_WORKFLOW_DESCRIPTION,
      create: () => docsCouncilWorkflow(env),
    },
    {
      id: DOCS_SUPERVISOR_WORKFLOW_ID,
      description: DOCS_SUPERVISOR_WORKFLOW_DESCRIPTION,
      create: () => docsSupervisorWorkflow(env),
    },
  ]
}
