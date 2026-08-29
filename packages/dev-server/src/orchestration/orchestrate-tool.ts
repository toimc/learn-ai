import type { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import type { AgentCall } from './patterns'
import { runDelegate, runParallel, runPipeline } from './patterns'

/** 编排闭包持有的子 agent：定义侧标识 + Mastra 实例（execute 时才包成 AgentCall） */
export interface TeamAgent {
  agentId: string
  model: string
  agent: Agent
}

function toAgentCall(member: TeamAgent): AgentCall {
  return {
    agentId: member.agentId,
    model: member.model,
    run: async (prompt) => {
      const result = await member.agent.generate([
        { role: 'user', content: prompt },
      ])
      const usage = result.usage
      return {
        text: result.text,
        ...(typeof usage?.inputTokens === 'number' ||
        typeof usage?.outputTokens === 'number'
          ? {
              usage: {
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
              },
            }
          : {}),
      }
    },
  }
}

/**
 * orchestrate 工具（spec 16 §3.2）：wire 工具名 orchestrate（id 即 toolName，对齐 get_weather）。
 * LLM 只做路由与汇报，协作过程经 tool_result 整体返回；description 是模型的路由文档。
 */
export function createOrchestrateTool(team: {
  researcher: TeamAgent
  writer: TeamAgent
  reviewer: TeamAgent
}) {
  const calls = {
    researcher: toAgentCall(team.researcher),
    writer: toAgentCall(team.writer),
    reviewer: toAgentCall(team.reviewer),
  }
  return createTool({
    id: 'orchestrate',
    description:
      '编排子 agent（检索员/起草员/审查员）协作完成 ai-chat-ui 组件库相关任务，返回各阶段产出、耗时与 token 用量。pattern 选用：delegate（委托）——检索员查文档、起草员写稿两步走查，适合单一明确的问题；parallel（并行）——三路检索员按组件用法/配置与主题定制/集成与数据流转并行取材，适合需要多角度覆盖的问题；pipeline（流水线）——检索、起草、审查，审查不过自动打回重写一次，适合对产出质量有要求的任务。NOT TO USE：闲聊、与组件库无关的问题、无需协作即可回答的简单追问——不要调用本工具。',
    inputSchema: z.object({
      pattern: z.enum(['delegate', 'parallel', 'pipeline']),
      task: z.string().describe('要编排完成的用户任务描述'),
    }),
    execute: async ({ pattern, task }) => {
      // 整体兜底：异常以错误字符串返回，不抛出、不打断父 Agent 链路（spec 16 §6）
      try {
        if (pattern === 'delegate') {
          return await runDelegate(task, {
            researcher: calls.researcher,
            writer: calls.writer,
          })
        }
        if (pattern === 'parallel') {
          return await runParallel(task, calls.researcher)
        }
        return await runPipeline(task, calls)
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}
