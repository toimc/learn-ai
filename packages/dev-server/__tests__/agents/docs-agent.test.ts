import { describe, expect, it } from 'vitest'
import { docsAgentDefinition, DOCS_AGENT_ID } from '../../src/agents/docs-agent'
import { createMemory } from '../../src/memory'

describe('docsAgentDefinition', () => {
  it('id/name/description 符合 spec（网关模型列表与前端展示来源）', () => {
    const def = docsAgentDefinition({ model: 'deepseek/deepseek-chat' })

    expect(def.id).toBe(DOCS_AGENT_ID)
    expect(def.id).toBe('docs-agent')
    expect(def.name).toBe('组件库助手')
    expect(def.description).toContain('组件库')
  })

  it('instructions 为 v3 契约：检索优先 + 防幻觉 + 输出格式', () => {
    const def = docsAgentDefinition({ model: 'deepseek/deepseek-chat' })
    const instructions = def.instructions ?? ''

    // 三份文档口径一致：instructions 引用的工具名必须真实注册
    expect(instructions).toContain('search_docs')
    // 防幻觉契约：没查到要说没查到，不凭记忆编造
    expect(instructions).toContain('未找到')
    // v3 输出契约：表格 + 300 字内
    expect(instructions).toContain('表格')
    expect(instructions).toContain('300')
  })

  it('工具仅挂 searchDocsTool，配最小 memory 工厂（thread 持久化供 Studio 回看）', () => {
    const def = docsAgentDefinition({ model: 'deepseek/deepseek-chat' })

    expect(Object.keys(def.tools ?? {})).toEqual(['searchDocsTool'])
    expect(def.memory).toBe(createMemory)
  })

  it('路由串直传模型配置', () => {
    const def = docsAgentDefinition({ model: 'deepseek/deepseek-chat' })
    expect(def.model).toBe('deepseek/deepseek-chat')
  })

  it('自定义端点走 { id, url, apiKey } 对象形态', () => {
    const def = docsAgentDefinition({
      model: 'my-qwen3',
      modelUrl: 'https://gw.example/v1/chat/completions',
      modelApiKey: 'sk-x',
    })
    expect(def.model).toEqual({
      id: 'my-qwen3',
      url: 'https://gw.example/v1',
      apiKey: 'sk-x',
    })
  })
})
