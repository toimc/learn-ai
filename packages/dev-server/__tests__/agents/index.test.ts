import { describe, expect, it } from 'vitest'
import { buildAgentDefinitions } from '../../src/agents/index'
import { CHAT_AGENT_ID } from '../../src/agents/chat-agent'

describe('buildAgentDefinitions', () => {
  it('产出 chat-agent 定义：路由串直传 + 双工具 + memory 工厂', () => {
    const [def] = buildAgentDefinitions({ model: 'deepseek/deepseek-chat' })
    expect(def.id).toBe(CHAT_AGENT_ID)
    expect(def.model).toBe('deepseek/deepseek-chat')
    expect(Object.keys(def.tools ?? {})).toEqual([
      'getTimeTool',
      'getWeatherTool',
    ])
    expect(typeof def.memory).toBe('function')
  })

  it('自定义端点走 { id, url } 对象形态', () => {
    const [def] = buildAgentDefinitions({
      model: 'my-qwen3',
      modelUrl: 'https://gw.example/v1',
      modelApiKey: 'sk-x',
    })
    expect(def.model).toEqual({
      id: 'my-qwen3',
      url: 'https://gw.example/v1',
      apiKey: 'sk-x',
    })
  })
})
