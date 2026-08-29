import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import type { MastraEnv } from '../env'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'
import {
  draftPrompt,
  parseVerdict,
  reviewPrompt,
  revisePrompt,
} from '../orchestration/prompts'

export const DOCS_PIPELINE_WORKFLOW_ID = 'docs-pipeline-workflow'

/** 注册表（registry.ts）与 createWorkflow 共用的描述常量（单一事实来源） */
export const DOCS_PIPELINE_WORKFLOW_DESCRIPTION =
  '文档流水线（检索→起草→审查→打回重写）：组件库文档问答的三段式质量门，researcher 检索 → writer 起草 → reviewer 审查，revise 打回重写一次（不再复审）。与聊天演示的 orchestrate 工具同源（手搓→原生教学阶梯）'

/**
 * 流水线的原生 Workflow 版（spec 16 §10 原生层）：
 * 检索 → 起草 → 审查 →（revise 时）打回重写 → 汇报，图结构与
 * 手搓 runPipeline 一致，prompt 模板共用 prompts.ts——两层行为同源。
 * 与手搓版的分工：聊天演示走 orchestrate 工具（SSE 卡片），
 * 本工作流注册进 Studio，/workflows 页可直接运行并查看逐步执行 trace。
 */
export function docsPipelineWorkflow(env: MastraEnv) {
  const [researcherDef, writerDef, reviewerDef] = teamDefinitions(env)
  const researcher = instantiateAgent(researcherDef)
  const writer = instantiateAgent(writerDef)
  const reviewer = instantiateAgent(reviewerDef)

  // 雪球式携带上下文：每步输出自包含（Studio trace 单步即可读全）
  const retrieve = createStep({
    id: 'retrieve',
    inputSchema: z.object({ task: z.string() }),
    outputSchema: z.object({ task: z.string(), research: z.string() }),
    execute: async ({ inputData, mastra }) => {
      const result = await researcher.generate(inputData.task)
      // 埋点演示：mastra 由框架注入，结构化日志经 observability 转发进 Studio logs 视图并与本 step 的 trace 关联
      mastra.getLogger().info('检索完成', {
        task: inputData.task,
        research_chars: result.text.length,
      })
      return { task: inputData.task, research: result.text }
    },
  })

  const draft = createStep({
    id: 'draft',
    inputSchema: z.object({ task: z.string(), research: z.string() }),
    outputSchema: z.object({
      task: z.string(),
      research: z.string(),
      draft: z.string(),
    }),
    execute: async ({ inputData }) => {
      const result = await writer.generate(
        draftPrompt(inputData.task, inputData.research),
      )
      return { ...inputData, draft: result.text }
    },
  })

  const review = createStep({
    id: 'review',
    inputSchema: z.object({
      task: z.string(),
      research: z.string(),
      draft: z.string(),
    }),
    outputSchema: z.object({
      task: z.string(),
      research: z.string(),
      draft: z.string(),
      verdict: z.enum(['pass', 'revise']),
      comment: z.string(),
    }),
    execute: async ({ inputData }) => {
      const result = await reviewer.generate(
        reviewPrompt(inputData.task, inputData.research, inputData.draft),
      )
      return {
        ...inputData,
        verdict: parseVerdict(result.text),
        comment: result.text,
      }
    },
  })

  // 打回重写：只走一次，不再复审（与手搓 runPipeline 口径一致）
  const revise = createStep({
    id: 'revise',
    inputSchema: z.object({
      task: z.string(),
      research: z.string(),
      draft: z.string(),
      verdict: z.enum(['pass', 'revise']),
      comment: z.string(),
    }),
    outputSchema: z.object({
      task: z.string(),
      research: z.string(),
      draft: z.string(),
      verdict: z.enum(['pass', 'revise']),
      comment: z.string(),
      finalDraft: z.string(),
      revised: z.boolean(),
    }),
    execute: async ({ inputData }) => {
      const result = await writer.generate(
        revisePrompt(
          inputData.task,
          inputData.research,
          inputData.draft,
          inputData.comment,
        ),
      )
      return { ...inputData, finalDraft: result.text, revised: true }
    },
  })

  // 汇报：branch 后输入是 { revise?: ... } 键控形态，review/revise 产出经
  // getStepResult 读取（1.60 branch 语义：分支步输出按 step id 为 key 可选挂载）
  const report = createStep({
    id: 'report',
    inputSchema: z.object({
      revise: z
        .object({
          task: z.string(),
          research: z.string(),
          draft: z.string(),
          verdict: z.enum(['pass', 'revise']),
          comment: z.string(),
          finalDraft: z.string(),
          revised: z.boolean(),
        })
        .optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      finalDraft: z.string(),
      verdict: z.enum(['pass', 'revise']),
      comment: z.string(),
      revised: z.boolean(),
    }),
    execute: async ({ getStepResult }) => {
      const reviewOut = getStepResult(review)
      const reviseOut = getStepResult(revise)
      const finalDraft = reviseOut?.finalDraft || reviewOut?.draft || ''
      return {
        task: reviewOut?.task ?? '',
        finalDraft,
        verdict: reviewOut?.verdict ?? 'pass',
        comment: reviewOut?.comment ?? '',
        revised: Boolean(reviseOut?.finalDraft),
      }
    },
  })

  return createWorkflow({
    id: DOCS_PIPELINE_WORKFLOW_ID,
    description: DOCS_PIPELINE_WORKFLOW_DESCRIPTION,
    inputSchema: z.object({ task: z.string().describe('要回答的组件库问题') }),
    outputSchema: z.object({
      task: z.string(),
      finalDraft: z.string(),
      verdict: z.enum(['pass', 'revise']),
      comment: z.string(),
      revised: z.boolean(),
    }),
    steps: [retrieve, draft, review, revise, report],
  })
    .then(retrieve)
    .then(draft)
    .then(review)
    .branch([
      // 1.60 的 branch 元组第二元素是单个 Step（非数组）
      [async ({ inputData }) => inputData.verdict === 'revise', revise],
    ])
    .then(report)
    .commit()
}
