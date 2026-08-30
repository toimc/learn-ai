import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { searchDocsTool } from '../../src/tools/search-docs'

/** createTool 传入的 inputSchema 就是 zod v4 实例（联合类型收窄有依据） */
const schema = searchDocsTool.inputSchema as z.ZodType

type ExecuteFn = NonNullable<typeof searchDocsTool.execute>
type ExecuteContext = Parameters<ExecuteFn>[1]

/** 最小执行上下文替身：search_docs 纯本地读文件，不触达 observe/trace */
function makeContext(): ExecuteContext {
  return {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    runtimeContext: {},
    observe: { span: async () => ({}), log: () => {} },
    trace: {},
  } as ExecuteContext
}

interface DocResult {
  source: string
  title: string
  snippet: string
  score: number
  matchedTerms: string[]
}

async function search(input: {
  keywords: string[]
  component?: string
}): Promise<{ results: DocResult[]; hint?: string }> {
  const fn = searchDocsTool.execute
  if (!fn) throw new Error('search_docs execute 未定义')
  return (await fn(input, makeContext())) as {
    results: DocResult[]
    hint?: string
  }
}

describe('search_docs 工具', () => {
  it('id 与描述符合 spec（description 是模型的路由文档）', () => {
    expect(searchDocsTool.id).toBe('search_docs')
    expect(searchDocsTool.description).toContain('检索')
    expect(searchDocsTool.description).toContain('文档')
  })

  it('inputSchema：keywords 数组必填，旧整串 query 形态拒绝（结构化杜绝整串字面匹配）', () => {
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ query: 'InputArea' }).success).toBe(false)
    expect(schema.safeParse({ keywords: ['InputArea'] }).success).toBe(true)
    expect(schema.safeParse({ keywords: [] }).success).toBe(false)
    expect(
      schema.safeParse({ keywords: ['InputArea'], component: 'InputArea' })
        .success,
    ).toBe(true)
  })

  it('口语化多词检索：聊天气泡+圆角 命中气泡组件与主题文档（旧实现整串 0 命中）', async () => {
    const { results } = await search({ keywords: ['聊天气泡', '圆角'] })

    const sources = results.map((r) => r.source)
    expect(sources).toContain('components/message-bubble.md')
    expect(sources).toContain('guide/theming.md')
  })

  it('同义词扩展：聊天气泡 命中 message-bubble 文档（文档只写"消息气泡/bubble"）', async () => {
    const { results } = await search({ keywords: ['聊天气泡'] })

    expect(
      results.some((r) => r.source === 'components/message-bubble.md'),
    ).toBe(true)
  })

  it('标题加权：查 ChatWindow 时 chat-window.md 排第一（正文引用次数不得压过标题命中）', async () => {
    const { results } = await search({ keywords: ['ChatWindow'] })

    expect(results[0].source).toBe('components/chat-window.md')
  })

  it('命中查询：InputArea 命中两文件，组件文档以更高分排第一', async () => {
    const { results } = await search({ keywords: ['InputArea'] })

    expect(results[0].source).toBe('components/input-area.md')
    expect(results[0].title).toBe('InputArea')
    expect(results[0].score).toBeGreaterThan(0)
    expect(results.some((r) => r.source === 'guide/i18n.md')).toBe(true)
    expect(results[0].matchedTerms.length).toBeGreaterThan(0)
  })

  it('片段截取不超过 400 字，且包含检索词上下文', async () => {
    const { results } = await search({ keywords: ['InputArea'] })

    expect(results[0].snippet.length).toBeLessThanOrEqual(400)
    expect(results[0].snippet.toLowerCase()).toContain('inputarea')
  })

  it('component 过滤词参与计分：keywords 不命中时组件文档仍因 component 入选', async () => {
    // toast 在 input-area.md 中 0 次——入选只可能来自 component 'InputArea' 计分
    const { results } = await search({
      keywords: ['Toast'],
      component: 'InputArea',
    })

    const inputArea = results.find(
      (r) => r.source === 'components/input-area.md',
    )
    expect(inputArea).toBeDefined()
    expect(inputArea?.score).toBeGreaterThan(0)
  })

  it('结果按 score 降序排序', async () => {
    const { results } = await search({ keywords: ['暗色'] })

    const scores = results.map((r) => r.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('无命中：返回空数组并给 hint 引导换词或列组件，不抛错', async () => {
    const { results, hint } = await search({ keywords: ['zzz不存在的词qqq'] })

    expect(results).toEqual([])
    expect(hint).toContain('list_components')
  })

  it('检索词含正则特殊字符：转义后正常执行', async () => {
    await expect(
      search({ keywords: ['props (v-model)'] }),
    ).resolves.toBeInstanceOf(Object)
  })
})

describe('search_docs 语义检索路（EMBEDDING_MODEL 门控）', () => {
  it('embedding 端点不可达时降级纯关键词：不抛错、关键词命中照常返回', async () => {
    vi.stubEnv('EMBEDDING_MODEL', 'bge-m3')
    // 无人监听的端口：doEmbed 连接被拒 → 向量路 catch 降级
    vi.stubEnv('EMBEDDING_MODEL_URL', 'http://127.0.0.1:9/v1')
    try {
      const { results } = await search({ keywords: ['聊天气泡'] })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].source).toContain('message-bubble')
    } finally {
      vi.unstubAllEnvs()
    }
  }, 20_000)

  it('EMBEDDING_MODEL 未配置时不尝试向量路（纯关键词行为，回归保护）', async () => {
    const { results } = await search({ keywords: ['ChatWindow'] })
    expect(results[0].source).toBe('components/chat-window.md')
  })
})
