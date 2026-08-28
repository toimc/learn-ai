import { describe, expect, it } from 'vitest'
import { resolveModelConfig } from '../../src/agents/model-config'

describe('resolveModelConfig', () => {
  it('无 modelUrl：路由串原样直传（Mastra 按 provider/model 路由）', () => {
    expect(resolveModelConfig({ model: 'deepseek/deepseek-chat' })).toBe(
      'deepseek/deepseek-chat',
    )
  })

  it('有 modelUrl：组装为 { id, url } 对象（url 规范化补全端点后缀）', () => {
    expect(
      resolveModelConfig({
        model: 'glm-4-plus',
        modelUrl: 'https://open.bigmodel.cn/api/paas/v4',
      }),
    ).toEqual({
      id: 'glm-4-plus',
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    })
  })

  it('有 modelUrl + modelApiKey：对象显式带 apiKey（实测 Mastra url 场景不自动读 provider env）', () => {
    expect(
      resolveModelConfig({
        model: 'openai/gpt-5.6-terra',
        modelUrl: 'https://2api.store/v1/chat/completions',
        modelApiKey: 'sk-e2e',
      }),
    ).toEqual({
      id: 'openai/gpt-5.6-terra',
      url: 'https://2api.store/v1/chat/completions',
      apiKey: 'sk-e2e',
    })
  })

  it('modelUrl 为空串时视为未设置，走路由串', () => {
    expect(resolveModelConfig({ model: 'openai/gpt-4o', modelUrl: '' })).toBe(
      'openai/gpt-4o',
    )
  })

  it('modelUrl 缺 /chat/completions 后缀时自动补全（AI SDK 把 url 当完整端点，裸 base 会打到中转站首页换 200 HTML 空流）', () => {
    expect(
      resolveModelConfig({
        model: 'openai/gpt-5.6-terra',
        modelUrl: 'https://2api.store/v1',
        modelApiKey: 'sk-e2e',
      }),
    ).toEqual({
      id: 'openai/gpt-5.6-terra',
      url: 'https://2api.store/v1/chat/completions',
      apiKey: 'sk-e2e',
    })
  })

  it('modelUrl 已带 /chat/completions 后缀时原样透传，不重复追加', () => {
    expect(
      resolveModelConfig({
        model: 'glm-4-plus',
        modelUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      }),
    ).toEqual({
      id: 'glm-4-plus',
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    })
  })
})
