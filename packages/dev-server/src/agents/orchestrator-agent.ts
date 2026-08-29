import type { MastraAgentDefinition } from '@toimc/server/mastra'
import type { MastraEnv } from '../env'
import { instantiateAgent, teamDefinitions } from '../orchestration/children'
import {
  createOrchestrateTool,
  type TeamAgent,
} from '../orchestration/orchestrate-tool'
import { resolveModelConfig } from './model-config'

export const ORCHESTRATOR_AGENT_ID = 'orchestrator-agent'

/**
 * orchestrator instructions（spec 16 §5.2）：
 * 自己不检索不起草、一律经 orchestrate；指令协议与 pattern 一一对应；
 * 汇报基于 OrchestrationResult 呈现而非改写；error 如实转述。
 */
export const ORCHESTRATOR_AGENT_INSTRUCTIONS = `你是多 Agent 编排助手：协调检索员、起草员、审查员完成 ai-chat-ui 组件库相关的任务。

职责边界：
- 你自己不检索、不起草、不审查——所有任务一律通过 orchestrate 工具交给子 agent 完成，不直接调 search_docs，不凭记忆回答组件库问题
- 不重写子 agent 的产出：呈现它们的稿，而不是以你的口吻改写

编排指令协议（与 orchestrate 的 pattern 一一对应）：
- 收到「本次使用委托模式编排任务」→ orchestrate(pattern=delegate)
- 收到「本次使用并行模式编排任务」→ orchestrate(pattern=parallel)
- 收到「本次使用流水线模式编排任务」→ orchestrate(pattern=pipeline)
- 用户消息带「【委托】」「【并行】」「【流水线】」前缀时，与上述指令同等对待
- 未见到上述指令时自行判断最合适的 pattern：单一明确的问题用 delegate，需要多角度覆盖用 parallel，对产出质量有要求用 pipeline

汇报规范（基于 orchestrate 返回的结果）：
- 流水线：呈现 finalDraft 与审查结论（[pass]/[revise]），被打回重写过就说明重写原因
- 并行：综合三路检索结果归纳回答，注明各路角度
- 委托：呈现起草员的稿
- 某一路或某个阶段 status 为 error 时，如实说明缺了什么、完成了什么，不编造缺失内容
- 汇报简洁、中文，先结论后细节`

/** 定义里的 model 是 string | { id, ... }，stage 展示用模型标识取其可读形态 */
function modelLabelOf(def: MastraAgentDefinition): string {
  return typeof def.model === 'string' ? def.model : String(def.model.id)
}

function toTeamAgent(def: MastraAgentDefinition): TeamAgent {
  return {
    agentId: def.id,
    model: modelLabelOf(def),
    agent: instantiateAgent(def),
  }
}

/** env → 网关 agent 定义：子 Agent 实例在工厂内创建一次，闭包进 orchestrate 工具（每次调用不重建） */
export function orchestratorAgentDefinition(
  env: MastraEnv,
): MastraAgentDefinition {
  const [researcherDef, writerDef, reviewerDef] = teamDefinitions(env)
  const orchestrateTool = createOrchestrateTool({
    researcher: toTeamAgent(researcherDef),
    writer: toTeamAgent(writerDef),
    reviewer: toTeamAgent(reviewerDef),
  })
  return {
    id: ORCHESTRATOR_AGENT_ID,
    name: '多 Agent 编排助手',
    description:
      '多 agent 编排演示：委托/并行/流水线三种协作形态，经 orchestrate 工具调度检索员/起草员/审查员',
    model: resolveModelConfig(env),
    instructions: ORCHESTRATOR_AGENT_INSTRUCTIONS,
    tools: { orchestrateTool },
    // 不配 memory：编排演示按次协作，会话上下文由 thread 携带即可
  }
}
