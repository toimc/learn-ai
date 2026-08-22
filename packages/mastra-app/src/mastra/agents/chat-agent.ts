import { Agent } from '@mastra/core/agent'
import { readAppEnv } from '../../env'
import { createMemory } from '../memory'
import { getTimeTool } from '../tools/get-time'
import { getWeatherTool } from '../tools/get-weather'
import { resolveModelConfig } from './model-config'

/** 模块加载即校验 env：缺 MASTRA_APP_MODEL 启动报可读错误（spec 12 §3.2） */
const env = readAppEnv()

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: 'chat-agent',
  // as 收窄对齐 @toimc/agents/mastra 先例：env 组装只产 string / { id, url } 两种
  // spec 认可形态；id 模板串约束（provider/model）由 env 配置约定保证
  model: resolveModelConfig(env) as ConstructorParameters<
    typeof Agent
  >[0]['model'],
  instructions:
    '你是 ai-chat-ui 的演示 Agent。需要时间或天气信息时调用对应工具，回答保持简洁。',
  tools: { getTimeTool, getWeatherTool },
  memory: createMemory(),
})
