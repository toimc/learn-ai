import { describe, expect, it } from 'vitest'
import {
  AnthropicAdapter,
  ModelRegistry,
  OpenAICompatibleAdapter,
} from '@toimc/agents'
import type { IModelAdapter } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'

function fakeAdapter(): IModelAdapter {
  return {
    chat: async () => ({ content: '', model: 'mock' }),
    chatStream: async function* (): AsyncGenerator<StreamChunk> {
      yield { type: 'done', content: '' }
    },
  }
}

const openaiConfig = {
  id: 'gpt',
  provider: 'openai-compat',
  model: 'gpt-5-mini',
  apiKey: 'sk-openai',
}

const anthropicConfig = {
  id: 'claude',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  apiKey: 'sk-ant',
}

describe('ModelRegistry.register（内置协议）', () => {
  it("provider 为 'openai-compat' 时创建 OpenAICompatibleAdapter 并持有同一 config", () => {
    const registry = new ModelRegistry().register(openaiConfig)
    const { adapter } = registry.get('gpt')
    expect(adapter instanceof OpenAICompatibleAdapter).toBe(true)
    expect((adapter as OpenAICompatibleAdapter).config).toBe(openaiConfig)
  })

  it("provider 为 'anthropic' 时创建 AnthropicAdapter 并持有同一 config", () => {
    const registry = new ModelRegistry().register(anthropicConfig)
    const { adapter } = registry.get('claude')
    expect(adapter instanceof AnthropicAdapter).toBe(true)
    expect((adapter as AnthropicAdapter).config).toBe(anthropicConfig)
  })

  it('未知 provider 抛错且错误消息包含 provider 名', () => {
    expect(() =>
      new ModelRegistry().register({
        id: 'x',
        provider: 'foo',
        model: 'some-model',
        apiKey: 'k',
      }),
    ).toThrow('foo')
  })

  it('name/description 缺省时 info 回退为 id 与空描述', () => {
    const { info } = new ModelRegistry()
      .register({
        id: 'glm',
        provider: 'openai-compat',
        model: 'glm-4.7',
        apiKey: 'k',
      })
      .get('glm')
    expect(info).toEqual({
      id: 'glm',
      name: 'glm',
      description: '',
      provider: 'openai-compat',
    })
  })
})

describe('ModelRegistry.registerAdapter（自定义适配器）', () => {
  it('get 返回注册的同一适配器实例，info 缺省回退 { id, name: id, description: "" }', () => {
    const adapter = fakeAdapter()
    const registry = new ModelRegistry().registerAdapter('mock', adapter)
    const registered = registry.get('mock')
    expect(registered.adapter).toBe(adapter)
    expect(registered.info).toEqual({
      id: 'mock',
      name: 'mock',
      description: '',
    })
  })

  it('传入 info 时公开视图使用给定的 name/description/provider', () => {
    const registry = new ModelRegistry().registerAdapter(
      'mock',
      fakeAdapter(),
      { name: 'Mock Pro', description: '剧本引擎', provider: 'mock' },
    )
    expect(registry.list()).toEqual([
      {
        id: 'mock',
        name: 'Mock Pro',
        description: '剧本引擎',
        provider: 'mock',
      },
    ])
  })
})

describe('ModelRegistry 查找', () => {
  it('get 未注册 id 抛错且错误消息包含该 id', () => {
    expect(() => new ModelRegistry().get('nope')).toThrow('nope')
  })

  it('has 按注册状态返回布尔值', () => {
    const registry = new ModelRegistry().register(openaiConfig)
    expect(registry.has('gpt')).toBe(true)
    expect(registry.has('unknown')).toBe(false)
  })
})

describe('ModelRegistry.list（公开视图脱敏）', () => {
  it('按注册顺序返回 {id,name,description,provider?}，不含 apiKey/baseURL', () => {
    const registry = new ModelRegistry()
      .register({
        id: 'gpt',
        provider: 'openai-compat',
        model: 'gpt-5-mini',
        apiKey: 'sk-openai',
        name: 'GPT',
        description: 'OpenAI 兼容',
      })
      .register({
        id: 'claude',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        apiKey: 'sk-ant',
        baseURL: 'https://proxy.example.com',
        name: 'Claude',
        description: 'Anthropic 原生',
      })
      .registerAdapter('mock', fakeAdapter(), {
        name: 'Mock',
        description: '剧本',
      })

    const list = registry.list()
    expect(list).toEqual([
      {
        id: 'gpt',
        name: 'GPT',
        description: 'OpenAI 兼容',
        provider: 'openai-compat',
      },
      {
        id: 'claude',
        name: 'Claude',
        description: 'Anthropic 原生',
        provider: 'anthropic',
      },
      { id: 'mock', name: 'Mock', description: '剧本' },
    ])

    const json = JSON.stringify(list)
    expect(json).not.toContain('apiKey')
    expect(json).not.toContain('baseURL')
    expect(json).not.toContain('sk-openai')
    expect(json).not.toContain('sk-ant')
  })
})

describe('ModelRegistry.removeAdapter（注销）', () => {
  it('移除已注册 id 返回 true，get 抛错且 list/has 不再包含', () => {
    const registry = new ModelRegistry()
      .register(openaiConfig)
      .registerAdapter('mock', fakeAdapter(), { name: 'Mock' })
    expect(registry.removeAdapter('mock')).toBe(true)
    expect(registry.has('mock')).toBe(false)
    expect(() => registry.get('mock')).toThrow('mock')
    expect(registry.list()).toEqual([
      {
        id: 'gpt',
        name: 'gpt',
        description: '',
        provider: 'openai-compat',
      },
    ])
  })

  it('移除不存在的 id 返回 false，其余注册项不受影响', () => {
    const registry = new ModelRegistry().register(openaiConfig)
    expect(registry.removeAdapter('nope')).toBe(false)
    expect(registry.has('gpt')).toBe(true)
  })

  it('移除后可重新注册同 id，持有新的适配器实例', () => {
    const replacement = fakeAdapter()
    const registry = new ModelRegistry().registerAdapter('mock', fakeAdapter())
    expect(registry.removeAdapter('mock')).toBe(true)
    registry.registerAdapter('mock', replacement)
    expect(registry.get('mock').adapter).toBe(replacement)
    expect(registry.list()).toEqual([
      { id: 'mock', name: 'mock', description: '' },
    ])
  })
})

describe('ModelRegistry 覆盖与链式', () => {
  it('同 id 重复 register 覆盖为新的适配器', () => {
    const replacement = { ...anthropicConfig, id: 'gpt' }
    const registry = new ModelRegistry()
      .register(openaiConfig)
      .register(replacement)
    const { adapter } = registry.get('gpt')
    expect(adapter instanceof AnthropicAdapter).toBe(true)
    expect((adapter as AnthropicAdapter).config).toBe(replacement)
  })

  it('同 id 重复 registerAdapter 覆盖且不产生重复条目', () => {
    const replacement = fakeAdapter()
    const registry = new ModelRegistry()
      .registerAdapter('mock', fakeAdapter())
      .registerAdapter('mock', replacement)
    expect(registry.get('mock').adapter).toBe(replacement)
    expect(registry.list()).toEqual([
      { id: 'mock', name: 'mock', description: '' },
    ])
  })

  it('register 与 registerAdapter 返回 this 支持链式注册', () => {
    const registry = new ModelRegistry()
    expect(registry.register(openaiConfig)).toBe(registry)
    expect(registry.registerAdapter('mock', fakeAdapter())).toBe(registry)
  })
})
