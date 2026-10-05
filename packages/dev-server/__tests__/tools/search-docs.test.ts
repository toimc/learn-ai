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
    expect(schema.safeParse({ query: 'PromptInput' }).success).toBe(false)
    expect(schema.safeParse({ keywords: ['PromptInput'] }).success).toBe(true)
    expect(schema.safeParse({ keywords: [] }).success).toBe(false)
    expect(
      schema.safeParse({ keywords: ['PromptInput'], component: 'PromptInput' })
        .success,
    ).toBe(true)
  })

  it('口语化多词检索：聊天气泡+圆角 命中气泡布局与主题文档（旧实现整串 0 命中）', async () => {
    const { results } = await search({ keywords: ['聊天气泡', '圆角'] })

    const sources = results.map((r) => r.source)
    expect(sources).toContain('composables/use-layout-config.md')
    expect(sources).toContain('guide/theming.md')
  })

  it('同义词扩展：聊天气泡 命中 use-layout-config 文档（文档只写"气泡"，不写口语词）', async () => {
    const { results } = await search({ keywords: ['聊天气泡'] })

    expect(results[0].source).toBe('composables/use-layout-config.md')
  })

  it('标题加权：查 Conversation 时 conversation.md 排第一（正文引用 18 次的 use-layout-config.md 不得压过标题命中）', async () => {
    const { results } = await search({ keywords: ['Conversation'] })

    expect(results[0].source).toBe('components/conversation.md')
  })

  it('命中查询：PromptInput 命中两文件，组件文档以更高分排第一', async () => {
    const { results } = await search({ keywords: ['PromptInput'] })

    expect(results[0].source).toBe('components/prompt-input.md')
    expect(results[0].title).toBe('PromptInput 系列')
    expect(results[0].score).toBeGreaterThan(0)
    expect(results.some((r) => r.source === 'guide/i18n.md')).toBe(true)
    expect(results[0].matchedTerms.length).toBeGreaterThan(0)
  })

  it('片段截取不超过 400 字，且包含检索词上下文', async () => {
    const { results } = await search({ keywords: ['PromptInput'] })

    expect(results[0].snippet.length).toBeLessThanOrEqual(400)
    expect(results[0].snippet.toLowerCase()).toContain('promptinput')
  })

  it('component 过滤词参与计分：keywords 不命中时组件文档仍因 component 入选', async () => {
    // shimmer 在 toast.md 中 0 次——入选只可能来自 component 'Toast' 计分
    const { results } = await search({
      keywords: ['Shimmer'],
      component: 'Toast',
    })

    const toast = results.find((r) => r.source === 'components/toast.md')
    expect(toast).toBeDefined()
    expect(toast?.score).toBeGreaterThan(0)
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
      // 关键词路靠 SYNONYMS（聊天气泡→气泡）照常命中气泡布局文档
      expect(results[0].source).toContain('use-layout-config')
    } finally {
      vi.unstubAllEnvs()
    }
  }, 20_000)

  it('EMBEDDING_MODEL 未配置时不尝试向量路（纯关键词行为，回归保护）', async () => {
    const { results } = await search({ keywords: ['Toast'] })
    expect(results[0].source).toBe('components/toast.md')
  })

  it('中英混排词按边界切分：「Message组件」关键词路可命中 message 文档', async () => {
    vi.stubEnv('EMBEDDING_MODEL', '')
    delete process.env.EMBEDDING_MODEL
    try {
      const { results } = await search({ keywords: ['Message组件'] })
      // 修复前：整串「message组件」字面不存在于任何文档 → 0 命中
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].source).toBe('components/message.md')
      expect(results[0].matchedTerms).toContain('message')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
