/**
 * 三种编排形态的纯函数实现（spec 16 §4/§5.1）：
 * 输入子 agent 调用接口 AgentCall，输出 OrchestrationResult——编排是代码不是提示词。
 * 本模块零 Mastra 依赖，唯一的副作用出口是 AgentCall.run。
 */

export type OrchestrationPattern = 'delegate' | 'parallel' | 'pipeline'

export type StageRole = 'researcher' | 'writer' | 'reviewer'

export interface AgentCall {
  agentId: string
  model: string
  run: (prompt: string) => Promise<{
    text: string
    usage?: { inputTokens: number; outputTokens: number }
  }>
}

export interface StageResult {
  role: StageRole
  /** 'researcher-agent' 等 */
  agentId: string
  status: 'ok' | 'error'
  durationMs: number
  /** 该阶段实际使用的模型标识 */
  model: string
  usage?: { inputTokens: number; outputTokens: number }
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 单阶段执行 + 装配（spec 16 §4）：agentId/model 取自 AgentCall，usage 缺省省略，run 抛错转 error stage */
async function runStage(
  role: StageRole,
  call: AgentCall,
  prompt: string,
): Promise<StageResult> {
  const start = Date.now()
  try {
    const reply = await call.run(prompt)
    return {
      role,
      agentId: call.agentId,
      status: 'ok',
      durationMs: Date.now() - start,
      model: call.model,
      ...(reply.usage ? { usage: reply.usage } : {}),
      output: reply.text,
    }
  } catch (error) {
    return {
      role,
      agentId: call.agentId,
      status: 'error',
      durationMs: Date.now() - start,
      model: call.model,
      output: toErrorMessage(error),
    }
  }
}

/** reviewer 首行 verdict 宽容解析（spec 16 §4）：[pass]/[revise] 不区分大小写，无法解析默认 pass */
export function parseVerdict(text: string): 'pass' | 'revise' {
  const firstLine = (text.split('\n')[0] ?? '').trim().toLowerCase()
  if (firstLine.startsWith('[revise]')) return 'revise'
  if (firstLine.startsWith('[pass]')) return 'pass'
  return 'pass'
}

const DRAFT_PROMPT_SUFFIX = '请基于以上检索结果起草回答。'

function draftPrompt(task: string, researchOutput: string): string {
  return `任务：${task}\n检索结果：\n${researchOutput}\n${DRAFT_PROMPT_SUFFIX}`
}

/** 委托：researcher 检索（收任务原文）→ writer 起草（任务+检索输出） */
export async function runDelegate(
  task: string,
  agents: { researcher: AgentCall; writer: AgentCall },
): Promise<OrchestrationResult> {
  const stages: StageResult[] = []

  const researcherStage = await runStage('researcher', agents.researcher, task)
  stages.push(researcherStage)
  // researcher 失败中止后续（spec 16 §6），finalDraft 空串
  if (researcherStage.status === 'error') {
    return { pattern: 'delegate', task, stages, finalDraft: '' }
  }

  const writerStage = await runStage(
    'writer',
    agents.writer,
    draftPrompt(task, researcherStage.output ?? ''),
  )
  stages.push(writerStage)
  return {
    pattern: 'delegate',
    task,
    stages,
    finalDraft: writerStage.status === 'ok' ? (writerStage.output ?? '') : '',
  }
}

/** 并行三路内置检索角度：stages 按此顺序输出（spec 16 §5.1 对拍口径） */
export const PARALLEL_ANGLES = [
  '组件用法与 API',
  '配置与主题定制',
  '集成与数据流转',
] as const

/** 并行：三路 researcher 各带角度提示，allSettled 单路失败不影响其他路，finalDraft 空串 */
export async function runParallel(
  task: string,
  researcher: AgentCall,
): Promise<OrchestrationResult> {
  const settled = await Promise.allSettled(
    PARALLEL_ANGLES.map((angle) =>
      runStage('researcher', researcher, `${task}\n检索角度：${angle}`),
    ),
  )
  // runStage 自吞错误，rejected 分支理论不可达；兜底仍转 error stage，维持 allSettled 语义
  const stages = settled.map((result): StageResult =>
    result.status === 'fulfilled'
      ? result.value
      : {
          role: 'researcher',
          agentId: researcher.agentId,
          status: 'error',
          durationMs: 0,
          model: researcher.model,
          output: toErrorMessage(result.reason),
        },
  )
  return { pattern: 'parallel', task, stages, finalDraft: '' }
}

/** 流水线：检索 → 起草 → 审查；revise 打回重写一次（不再复审），verdict 挂 reviewer stage */
export async function runPipeline(
  task: string,
  agents: { researcher: AgentCall; writer: AgentCall; reviewer: AgentCall },
): Promise<OrchestrationResult> {
  const stages: StageResult[] = []

  const researcherStage = await runStage('researcher', agents.researcher, task)
  stages.push(researcherStage)
  if (researcherStage.status === 'error') {
    return { pattern: 'pipeline', task, stages, finalDraft: '' }
  }
  const researchOutput = researcherStage.output ?? ''

  const writerStage = await runStage(
    'writer',
    agents.writer,
    draftPrompt(task, researchOutput),
  )
  stages.push(writerStage)
  if (writerStage.status === 'error') {
    return { pattern: 'pipeline', task, stages, finalDraft: '' }
  }
  const draft = writerStage.output ?? ''

  const reviewerStage = await runStage(
    'reviewer',
    agents.reviewer,
    `任务：${task}\n检索结果：\n${researchOutput}\n草稿：\n${draft}\n审查以上草稿：首行输出 [pass] 或 [revise]，随后给出意见。`,
  )
  const reviewerWithVerdict =
    reviewerStage.status === 'ok'
      ? {
          ...reviewerStage,
          meta: {
            ...(reviewerStage.meta ?? {}),
            verdict: parseVerdict(reviewerStage.output ?? ''),
          },
        }
      : reviewerStage
  stages.push(reviewerWithVerdict)
  if (reviewerStage.status === 'error') {
    return { pattern: 'pipeline', task, stages, finalDraft: '' }
  }

  if (reviewerWithVerdict.meta?.verdict === 'revise') {
    const retryStage = await runStage(
      'writer',
      agents.writer,
      `任务：${task}\n检索结果：\n${researchOutput}\n上一版草稿：\n${draft}\n审查意见：\n${reviewerStage.output}\n请根据审查意见重写回答。`,
    )
    stages.push({
      ...retryStage,
      // 重写 stage 只挂 retried，不重复挂 verdict（spec 16 §5.1 对拍口径）
      meta: { ...(retryStage.meta ?? {}), retried: true },
    })
    return {
      pattern: 'pipeline',
      task,
      stages,
      finalDraft: retryStage.status === 'ok' ? (retryStage.output ?? '') : '',
    }
  }

  return { pattern: 'pipeline', task, stages, finalDraft: draft }
}
