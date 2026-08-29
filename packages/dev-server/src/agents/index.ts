import type { MastraAgentDefinition } from '@toimc/server/mastra'
import type { MastraEnv } from '../env'
import { chatAgentDefinition } from './chat-agent'
import { docsAgentDefinition } from './docs-agent'
import { orchestratorAgentDefinition } from './orchestrator-agent'

/**
 * agent 注册表（spec 14 FR8 的落点）：
 * 新增 agent = 在本目录加一个定义文件 + 此数组加一行。
 * 多 agent 编排的子 agent 不在此注册（spec 16 §2）：走 teamDefinitions，仅 Studio 组装。
 * context7Tools 由装配层（网关线 app.ts / Studio 线 mastra/index.ts）注入，仅挂 docs-agent。
 */
export function buildAgentDefinitions(
  env: MastraEnv,
  context7Tools: Record<string, unknown> = {},
): MastraAgentDefinition[] {
  return [
    chatAgentDefinition(env),
    docsAgentDefinition(env, context7Tools),
    orchestratorAgentDefinition(env),
  ]
}
