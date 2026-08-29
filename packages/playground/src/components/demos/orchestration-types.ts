/**
 * OrchestrationResult 的本地声明（与 spec 16 §3.3 完全一致）。
 * playground 不依赖 @toimc/dev-server 私有包，卡片数据源以本文件为唯一契约；
 * 运行时校验用于「结构不符回退原始 JSON」的降级判断。
 */

export const ORCHESTRATION_PATTERNS = [
  'delegate',
  'parallel',
  'pipeline',
] as const
export type OrchestrationPattern = (typeof ORCHESTRATION_PATTERNS)[number]

export const STAGE_ROLES = ['researcher', 'writer', 'reviewer'] as const
export type StageRole = (typeof STAGE_ROLES)[number]

export interface StageUsage {
  inputTokens: number
  outputTokens: number
}

export interface StageResult {
  role: StageRole
  /** 'researcher-agent' 等 */
  agentId: string
  status: 'ok' | 'error'
  durationMs: number
  /** 该阶段实际使用的模型标识 */
  model: string
  usage?: StageUsage
  /** 该阶段产出，卡片内折叠展示；error 时为错误摘要 */
  output?: string
  meta?: { retried?: boolean; verdict?: 'pass' | 'revise' }
}

export interface OrchestrationResult {
  pattern: OrchestrationPattern
  task: string
  stages: StageResult[]
  /** 流水线=终稿；委托=writer 稿；并行=空串（由 orchestrator 综合） */
  finalDraft: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isStageResult(v: unknown): v is StageResult {
  if (!isRecord(v)) return false
  return (
    STAGE_ROLES.includes(v.role as StageRole) &&
    typeof v.agentId === 'string' &&
    (v.status === 'ok' || v.status === 'error') &&
    typeof v.durationMs === 'number' &&
    typeof v.model === 'string'
  )
}

/** result 结构与 OrchestrationResult 对齐才渲染卡片，否则调用方回退原始 JSON */
export function isOrchestrationResult(v: unknown): v is OrchestrationResult {
  if (!isRecord(v)) return false
  return (
    ORCHESTRATION_PATTERNS.includes(v.pattern as OrchestrationPattern) &&
    typeof v.task === 'string' &&
    Array.isArray(v.stages) &&
    v.stages.every(isStageResult) &&
    typeof v.finalDraft === 'string'
  )
}
