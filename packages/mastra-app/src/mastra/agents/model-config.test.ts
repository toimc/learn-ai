import { describe, expect, it } from 'vitest'
import { resolveModelConfig } from './model-config'

describe('resolveModelConfig', () => {
  it('无 modelUrl：路由串原样直传（Mastra 按 provider/model 路由）', () => {
    expect(resolveModelConfig({ model: 'deepseek/deepseek-chat' })).toBe(
      'deepseek/deepseek-chat',
    )
  })

  it('有 modelUrl：组装为 { id, url } 对象（OpenAI 兼容端点形态）', () => {
    expect(
      resolveModelConfig({
        model: 'glm-4-plus',
        modelUrl: 'https://open.bigmodel.cn/api/paas/v4',
      }),
    ).toEqual({
      id: 'glm-4-plus',
      url: 'https://open.bigmodel.cn/api/paas/v4',
    })
  })

  it('modelUrl 为空串时视为未设置，走路由串', () => {
    expect(resolveModelConfig({ model: 'openai/gpt-4o', modelUrl: '' })).toBe(
      'openai/gpt-4o',
    )
  })
})
