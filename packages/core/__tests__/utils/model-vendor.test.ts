import { describe, it, expect } from 'vitest'
import {
  detectModelVendor,
  groupModelsByVendor,
} from '../../src/utils/model-vendor'

// 预期值来源：toimc-sub2api modelVendor.ts 规则表的已知输出手写抄录
// （gemini→google / grok→xAI / glm→zhipu / kimi→moonshot 为计划卡 T1 的厂商枚举映射）

describe('detectModelVendor', () => {
  it('claude 前缀归 anthropic，matchedBy 为命中规则', () => {
    expect(detectModelVendor('deepseek-chat')).toEqual({
      vendor: 'deepseek',
      label: 'DeepSeek',
      matchedBy: '^deepseek-',
    })
  })

  it('claude 前缀归 anthropic', () => {
    expect(detectModelVendor('claude-sonnet-4-5')).toMatchObject({
      vendor: 'anthropic',
      label: 'Anthropic',
    })
  })

  it('openai 家族前缀（gpt/chatgpt/o 系）归 openai', () => {
    expect(detectModelVendor('gpt-4o-mini').vendor).toBe('openai')
    expect(detectModelVendor('chatgpt-4o-latest').vendor).toBe('openai')
    expect(detectModelVendor('o3-mini').vendor).toBe('openai')
    expect(detectModelVendor('whisper-1').vendor).toBe('openai')
  })

  it('gemini/learnlm 前缀归 google', () => {
    expect(detectModelVendor('gemini-2.5-pro').vendor).toBe('google')
    expect(detectModelVendor('learnlm-1.5-pro').vendor).toBe('google')
  })

  it('glm 前缀归 zhipu', () => {
    expect(detectModelVendor('glm-4.6').vendor).toBe('zhipu')
  })

  it('qwen 前缀（无横线也命中）归 qwen', () => {
    expect(detectModelVendor('qwen3-max').vendor).toBe('qwen')
    expect(detectModelVendor('qwen2.5-72b-instruct').vendor).toBe('qwen')
  })

  it('grok 前缀归 xai', () => {
    expect(detectModelVendor('grok-4').vendor).toBe('xai')
  })

  it('kimi/moonshot 前缀归 moonshot', () => {
    expect(detectModelVendor('kimi-k2-instruct').vendor).toBe('moonshot')
    expect(detectModelVendor('moonshot-v1-8k').vendor).toBe('moonshot')
  })

  it('minimax 与 abab 前缀归 minimax', () => {
    expect(detectModelVendor('minimax-m2').vendor).toBe('minimax')
    expect(detectModelVendor('abab6.5s-chat').vendor).toBe('minimax')
  })

  it('doubao 前缀归 doubao', () => {
    expect(detectModelVendor('doubao-seed-1-6').vendor).toBe('doubao')
  })

  it('mistral 家族前缀归 mistral', () => {
    expect(detectModelVendor('mistral-large-latest').vendor).toBe('mistral')
    expect(detectModelVendor('mixtral-8x7b-32768').vendor).toBe('mistral')
    expect(detectModelVendor('codestral-latest').vendor).toBe('mistral')
  })

  it('llama/meta-llama 前缀归 meta', () => {
    expect(detectModelVendor('llama-3.1-8b-instruct').vendor).toBe('meta')
  })

  it('command/c4ai 前缀归 cohere', () => {
    expect(detectModelVendor('command-r-plus-08-2024').vendor).toBe('cohere')
  })

  it('yi 前缀归 yi', () => {
    expect(detectModelVendor('yi-lightning').vendor).toBe('yi')
  })

  it('ernie 前缀归 wenxin', () => {
    expect(detectModelVendor('ernie-4.5-turbo').vendor).toBe('wenxin')
  })

  it('斜杠前缀取末段再匹配（openrouter/官方路由形态）', () => {
    expect(
      detectModelVendor('anthropic/claude-3-5-sonnet-20241022').vendor,
    ).toBe('anthropic')
    expect(detectModelVendor('openai/gpt-4o').vendor).toBe('openai')
    expect(detectModelVendor('meta-llama/Llama-3.3-70B-Instruct').vendor).toBe(
      'meta',
    )
  })

  it('大小写与首尾空白归一化后匹配', () => {
    expect(detectModelVendor('GPT-4o').vendor).toBe('openai')
    expect(detectModelVendor('  DeepSeek-Chat  ').vendor).toBe('deepseek')
  })

  it('未命中规则归 unknown，label 为空串交由调用方本地化', () => {
    expect(detectModelVendor('totally-unknown-model')).toEqual({
      vendor: 'unknown',
      label: '',
    })
  })

  it('空字符串归 unknown', () => {
    expect(detectModelVendor('').vendor).toBe('unknown')
  })
})

describe('groupModelsByVendor', () => {
  it('按厂商分组且组内保持输入顺序', () => {
    const groups = groupModelsByVendor([
      'deepseek-chat',
      'gpt-4o',
      'deepseek-reasoner',
      'claude-sonnet-4-5',
      'mystery-model',
    ])
    expect(groups.deepseek).toEqual(['deepseek-chat', 'deepseek-reasoner'])
    expect(groups.openai).toEqual(['gpt-4o'])
    expect(groups.anthropic).toEqual(['claude-sonnet-4-5'])
    expect(groups.unknown).toEqual(['mystery-model'])
  })

  it('返回 Record 含全部 16 个厂商键（空组为空数组）', () => {
    const groups = groupModelsByVendor(['glm-4.6'])
    expect(Object.keys(groups)).toHaveLength(16)
    expect(groups.zhipu).toEqual(['glm-4.6'])
    expect(groups.openai).toEqual([])
    expect(groups.unknown).toEqual([])
  })

  it('空输入返回全空分组', () => {
    const groups = groupModelsByVendor([])
    expect(Object.keys(groups)).toHaveLength(16)
    expect(Object.values(groups).every((ids) => ids.length === 0)).toBe(true)
  })
})
