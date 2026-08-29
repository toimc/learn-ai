import { Agent } from '@mastra/core/agent'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { resolveModelConfig } from '../agents/model-config'
import type { MastraEnv } from '../env'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'

export const DOCS_SUPERVISOR_WORKFLOW_ID = 'docs-supervisor-workflow'

/** 注册表（registry.ts）与 createWorkflow 共用的描述常量（单一事实来源） */
export const DOCS_SUPERVISOR_WORKFLOW_DESCRIPTION =
  '文档主管循环（supervisor 决定调谁/何时完成）：主 agent 每轮结构化决策委派检索员或起草员，dountil 循环至任务完成或轮次上限（Supervisor 模式原生版）。与聊天演示的 orchestrate 工具同源'

/** 委派轮次上限（16-03：步数预算防无限循环，supervisor maxSteps 同思想） */
export const SUPERVISOR_MAX_ROUNDS = 6

/** supervisor 每轮的结构化决策（16-03 instructions 三段式 + 委派即工具调用） */
const decisionSchema = z.object({
  action: z
    .enum(['research', 'draft', 'done'])
    .describe(
      '本轮决策：research=委派检索员 / draft=委派起草员 / done=任务完成',
    ),
  instructions: z
    .string()
    .describe(
      '给子 agent 的本轮具体指令（做什么、用什么关键词/材料）；done 时留空',
    ),
})

/**
 * Supervisor 模式的原生 Workflow 版（spec 16 §10 扩展）：
 * 主 agent 每轮经 structuredOutput 决定委派哪个子 agent、何时完成，
 * dountil 循环到决策 done 或轮次上限——控制权始终在主 agent 手里
 * （16-03 四模式中 Supervisor 的定义），每轮决策与子 agent 产出都在 trace 可见。
 */
export function docsSupervisorWorkflow(env: MastraEnv) {
  const [researcherDef, writerDef] = teamDefinitions(env)
  const researcher = instantiateAgent(researcherDef)
  const writer = instantiateAgent(writerDef)

  // 主 agent：主模型，instructions 三段式（可用资源/委派策略/成功标准）
  const supervisor = new Agent({
    id: 'supervisor-agent',
    name: '编排主管',
    instructions: `你是多 agent 编排的主管（supervisor），负责决定每一步委派给哪个子 agent、何时完成任务。

可用资源：
- research：检索员，只读检索 ai-chat-ui 文档，返回要点清单+出处，不成文
- draft：起草员，基于给定材料起草回答，无工具

委派策略：
- 信息不足先 research；材料够了再 draft；回答已成形且可交付则 done
- 每轮只做一个决定，instructions 写清本轮要子 agent 具体做什么
- 已有的过程记录会随轮次累积，不重复委派已完成的工作

成功标准：
- 任务问题的每个方面都有检索材料支撑，最终能形成有出处的回答
- 材料足够即收，不无限检索；总轮次有限，珍惜每一次委派`,
    // 定义层宽松 Record 在此收窄（对齐 orchestration/children.ts 的装配约定）
    model: resolveModelConfig(env) as ConstructorParameters<
      typeof Agent
    >[0]['model'],
  })

  const supervisorState = z.object({
    task: z.string(),
    /** 委派过程记录：每轮追加 [action] instructions + 子 agent 产出 */
    transcript: z.string().optional(),
    decision: z.enum(['research', 'draft', 'done']).optional(),
    lastResult: z.string().optional(),
  })

  // 一轮委派：supervisor 决策 → 调对应子 agent → 累积 transcript
  const delegate = createStep({
    id: 'delegate',
    inputSchema: supervisorState,
    outputSchema: supervisorState,
    execute: async ({ inputData }) => {
      const transcript = inputData.transcript ?? ''
      const decision = await supervisor.generate(
        `任务：${inputData.task}\n\n已有过程记录：\n${transcript || '（尚无）'}\n\n决定下一轮委派（research / draft / done）与给子 agent 的指令。`,
        { structuredOutput: { schema: decisionSchema } },
      )
      const d = decision.object

      if (d.action === 'done') {
        return { ...inputData, decision: 'done' as const, lastResult: '' }
      }

      const expert = d.action === 'research' ? researcher : writer
      const result = await expert.generate(
        `${d.instructions}\n\n任务背景：${inputData.task}\n\n已有材料：\n${transcript || '（尚无）'}`,
      )
      return {
        ...inputData,
        transcript: `${transcript}\n\n--- [${d.action}] ${d.instructions}\n${result.text}`,
        decision: d.action,
        lastResult: result.text,
      }
    },
  })

  // 收尾汇报：supervisor 综合过程记录产出最终回答（父 Agent 独占用户对话）
  const report = createStep({
    id: 'report',
    inputSchema: supervisorState,
    outputSchema: z.object({
      task: z.string(),
      finalReport: z.string(),
      rounds: z.number(),
    }),
    execute: async ({ inputData }) => {
      const rounds = (inputData.transcript ?? '').split('\n--- [').length - 1
      if (!inputData.transcript) {
        return { task: inputData.task, finalReport: '', rounds: 0 }
      }
      const result = await supervisor.generate(
        `任务：${inputData.task}\n\n完整过程记录：\n${inputData.transcript}\n\n请基于以上过程记录输出最终回答：结论先行，要点清晰，附材料出处。`,
      )
      return {
        task: inputData.task,
        finalReport: result.text,
        rounds,
      }
    },
  })

  return createWorkflow({
    id: DOCS_SUPERVISOR_WORKFLOW_ID,
    description: DOCS_SUPERVISOR_WORKFLOW_DESCRIPTION,
    inputSchema: z.object({ task: z.string().describe('要完成的组件库问题') }),
    outputSchema: z.object({
      task: z.string(),
      finalReport: z.string(),
      rounds: z.number(),
    }),
    steps: [delegate, report],
  })
    .dountil(delegate, async ({ inputData, iterationCount }) => {
      // 决策 done 或轮次上限（防无限循环）即停
      if (inputData.decision === 'done') return true
      return iterationCount >= SUPERVISOR_MAX_ROUNDS
    })
    .then(report)
    .commit()
}
