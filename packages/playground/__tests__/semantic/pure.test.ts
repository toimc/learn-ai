import { describe, expect, it } from 'vitest'
import {
  cosineTopK,
  describeConversation,
  keywordSearch,
  resolveBackend,
} from '../../src/semantic/pure'

describe('describeConversation', () => {
  it('拼接标题与首条用户消息（跳过非用户消息）', () => {
    const c = {
      id: 'e1',
      title: '聊聊 AI 交互体验',
      messages: [
        { role: 'assistant', content: '你好，有什么可以帮你？' },
        { role: 'user', content: '长列表渲染卡顿怎么优化' },
        { role: 'user', content: '第二条用户消息不应被拼入' },
      ],
    }
    expect(describeConversation(c)).toBe(
      '聊聊 AI 交互体验 长列表渲染卡顿怎么优化',
    )
  })

  it('没有用户消息时只保留标题', () => {
    const c = {
      id: 'e2',
      title: '组件库主题定制',
      messages: [{ role: 'assistant', content: '你好' }],
    }
    expect(describeConversation(c)).toBe('组件库主题定制 ')
  })

  it('超过 200 字截断，控制单次 embedding 耗时', () => {
    const title = '甲'.repeat(120)
    const firstUser = '乙'.repeat(200)
    const out = describeConversation({
      id: 'e3',
      title,
      messages: [{ role: 'user', content: firstUser }],
    })
    // 手算：120 甲 + 1 空格 + 79 乙 = 200（200 - 121 = 79）
    expect(out.length).toBe(200)
    expect(out.slice(0, 120)).toBe('甲'.repeat(120))
    expect(out[120]).toBe(' ')
    expect(out.slice(121)).toBe('乙'.repeat(79))
  })

  it('支持自定义截断长度', () => {
    const out = describeConversation(
      {
        id: 'e4',
        title: '标题',
        messages: [{ role: 'user', content: '内容' }],
      },
      3,
    )
    expect(out).toBe('标题 ')
  })
})

describe('cosineTopK（归一化向量点积即余弦）', () => {
  const items = [
    { id: 'a', vector: [0.6, 0.8, 0] },
    { id: 'b', vector: [1, 0, 0] },
    { id: 'c', vector: [0, 1, 0] },
    { id: 'd', vector: [0.8, 0.6, 0] },
  ]

  it('按点积降序返回并截取 Top-K', () => {
    // 手算：query=[1,0,0] → a=0.6 b=1 c=0 d=0.8
    const top2 = cosineTopK([1, 0, 0], items, 2)
    expect(top2).toEqual([
      { id: 'b', score: 1 },
      { id: 'd', score: 0.8 },
    ])
  })

  it('非正交向量的点积手算', () => {
    // 手算：0.6*1 + 0.8*0 = 0.6；0.6*0.6 + 0.8*0.8 = 0.36 + 0.64 = 1
    const result = cosineTopK(
      [0.6, 0.8],
      [
        { id: 'x', vector: [1, 0] },
        { id: 'y', vector: [0.6, 0.8] },
      ],
    )
    expect(result).toEqual([
      { id: 'y', score: 1 },
      { id: 'x', score: 0.6 },
    ])
  })

  it('K 大于条目数时返回全部（默认 K=5）', () => {
    const result = cosineTopK([1, 0, 0], items)
    expect(result.map((r) => r.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('维度不一致的脏向量被跳过（换模型重建索引前的兜底）', () => {
    const result = cosineTopK(
      [1, 0],
      [
        { id: 'ok', vector: [1, 0] },
        { id: 'stale', vector: [1, 0, 0, 0] },
      ],
    )
    expect(result).toEqual([{ id: 'ok', score: 1 }])
  })

  it('空查询或空条目返回空数组', () => {
    expect(cosineTopK([], items)).toEqual([])
    expect(cosineTopK([1, 0], [])).toEqual([])
  })

  it('Float32Array 查询向量与 number[] 等价', () => {
    const result = cosineTopK(new Float32Array([1, 0]), [
      { id: 'f', vector: [0.5, 0.5] },
    ])
    expect(result).toEqual([{ id: 'f', score: 0.5 }])
  })
})

describe('keywordSearch（12-03 基线：标题字面包含）', () => {
  const items = [
    { id: 'e1', title: '聊聊 AI 交互体验' },
    { id: 'e5', title: 'Vite 构建优化' },
  ]

  it('按标题子串命中（中文）', () => {
    expect(keywordSearch('交互体验', items)).toEqual([{ id: 'e1', score: 1 }])
  })

  it('英文大小写不敏感', () => {
    expect(keywordSearch('VITE', items)).toEqual([{ id: 'e5', score: 1 }])
  })

  it('字面对不上时返回空（语义搜索要解决的场景）', () => {
    expect(keywordSearch('浏览器性能优化', items)).toEqual([])
  })

  it('空或纯空白查询返回空数组', () => {
    expect(keywordSearch('', items)).toEqual([])
    expect(keywordSearch('   ', items)).toEqual([])
  })
})

describe('resolveBackend（三级降级决策）', () => {
  it('WebGPU 可用优先 WebGPU', () => {
    expect(resolveBackend(true, true)).toBe('webgpu')
    expect(resolveBackend(true, false)).toBe('webgpu')
  })

  it('无 WebGPU 回退 WASM', () => {
    expect(resolveBackend(false, true)).toBe('wasm')
  })

  it('两者皆不可用降级关键字匹配', () => {
    expect(resolveBackend(false, false)).toBe('keyword')
  })
})
