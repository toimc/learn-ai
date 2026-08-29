import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import type { MastraEnv } from '../env'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'
import { PARALLEL_ANGLES } from '../orchestration/patterns'
import { parallelPrompt } from '../orchestration/prompts'

export const DOCS_COUNCIL_WORKFLOW_ID = 'docs-council-workflow'

/**
 * 并行检索的原生 Workflow 版（spec 16 §10 原生层）：
 * 三路 researcher 独立检索（.parallel()）→ writer 综合裁决，
 * 与手搓 runParallel 的三角度一致。展示 workflow 原生的并行原语。
 */
export function docsCouncilWorkflow(env: MastraEnv) {
  const [researcherDef, writerDef] = teamDefinitions(env)
  const researcher = instantiateAgent(researcherDef)
  const writer = instantiateAgent(writerDef)

  const retrieveStep = (id: string, angle: string) =>
    createStep({
      id,
      inputSchema: z.object({ task: z.string() }),
      outputSchema: z.object({ research: z.string() }),
      execute: async ({ inputData }) => {
        const result = await researcher.generate(
          parallelPrompt(inputData.task, angle),
        )
        return { research: result.text }
      },
    })

  const retrieveApi = retrieveStep('retrieve_api', PARALLEL_ANGLES[0])
  const retrieveTheme = retrieveStep('retrieve_theme', PARALLEL_ANGLES[1])
  const retrieveData = retrieveStep('retrieve_data', PARALLEL_ANGLES[2])

  // .parallel() 的输出以 step id 为 key 汇成对象（1.60 类型为索引签名）
  const synthesize = createStep({
    id: 'synthesize',
    inputSchema: z.record(z.string(), z.object({ research: z.string() })),
    outputSchema: z.object({
      api: z.string(),
      theme: z.string(),
      data: z.string(),
      finalReport: z.string(),
    }),
    execute: async ({ inputData }) => {
      const result = await writer.generate(
        `任务：综合以下三路检索结果，整理成一份要点清晰的回答（结论先行，冲突之处注明来源角度）。\n` +
          `[组件用法与 API]\n${inputData.retrieve_api.research}\n\n` +
          `[配置与主题定制]\n${inputData.retrieve_theme.research}\n\n` +
          `[集成与数据流转]\n${inputData.retrieve_data.research}`,
      )
      return {
        api: inputData.retrieve_api.research,
        theme: inputData.retrieve_theme.research,
        data: inputData.retrieve_data.research,
        finalReport: result.text,
      }
    },
  })

  return createWorkflow({
    id: DOCS_COUNCIL_WORKFLOW_ID,
    description:
      '文档议会（三视角并行检索→综合）：同一问题从「组件用法/配置主题/集成数据」三个角度独立检索后综合裁决（Council 模式原生版）。与聊天演示的 orchestrate 工具同源',
    inputSchema: z.object({ task: z.string().describe('要检索的组件库问题') }),
    outputSchema: z.object({
      api: z.string(),
      theme: z.string(),
      data: z.string(),
      finalReport: z.string(),
    }),
    steps: [retrieveApi, retrieveTheme, retrieveData, synthesize],
  })
    .parallel([retrieveApi, retrieveTheme, retrieveData])
    .then(synthesize)
    .commit()
}
