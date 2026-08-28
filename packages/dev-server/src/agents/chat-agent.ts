import type { MastraAgentDefinition } from '@toimc/server/mastra'
import { createMemory } from '../memory'
import { resolveModelConfig } from './model-config'
import { getTimeTool } from '../tools/get-time'
import { getWeatherTool } from '../tools/get-weather'

export const CHAT_AGENT_ID = 'chat-agent'

/** chat-agent 与运行时 custom-agent 共用的系统指令（两条装配路径保持同一人设） */
export const CHAT_AGENT_INSTRUCTIONS =
  '你是 ai-chat-ui 的演示 Agent。需要时间或天气信息时调用对应工具，回答保持简洁。'

/** env → 网关 agent 定义（spec 14 §5.3：注册名统一为 chat-agent） */
export function chatAgentDefinition(config: {
  model: string
  modelUrl?: string
  modelApiKey?: string
  modelName?: string
}): MastraAgentDefinition {
  return {
    id: CHAT_AGENT_ID,
    name: config.modelName ?? 'Chat Agent',
    description: `Mastra 驱动的 Agent（${config.model}），支持工具调用与会话记忆`,
    model: resolveModelConfig(config),
    instructions: CHAT_AGENT_INSTRUCTIONS,
    tools: { getTimeTool, getWeatherTool },
    memory: createMemory,
  }
}
