import { describe, expect, it } from 'vitest'
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
}

async function search(input: { query: string; component?: string }) {
  const fn = searchDocsTool.execute
  if (!fn) throw new Error('search_docs execute 未定义')
  const raw = (await fn(input, makeContext())) as { results: DocResult[] }
  return raw.results
}

describe('search_docs 工具', () => {
  it('id 与描述符合 spec（description 是模型的路由文档）', () => {
    expect(searchDocsTool.id).toBe('search_docs')
    expect(searchDocsTool.description).toContain('检索')
    expect(searchDocsTool.description).toContain('文档')
  })

  it('inputSchema：query 必填，component 可选', () => {
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ query: 'InputArea' }).success).toBe(true)
    expect(
      schema.safeParse({ query: 'InputArea', component: 'InputArea' }).success,
    ).toBe(true)
  })

  it('命中查询：InputArea 命中两文件，组件文档以更高分排第一', async () => {
    const results = await search({ query: 'InputArea' })

    // 大小写不敏感：components/input-area.md（4 次）与 guide/i18n.md（inputArea）
    expect(results[0].source).toBe('components/input-area.md')
    expect(results[0].title).toBe('InputArea')
    expect(results[0].score).toBeGreaterThan(0)
    expect(results.some((r) => r.source === 'guide/i18n.md')).toBe(true)
  })

  it('片段截取不超过 400 字，且包含检索词上下文', async () => {
    const results = await search({ query: 'InputArea' })

    expect(results[0].snippet.length).toBeLessThanOrEqual(400)
    expect(results[0].snippet.toLowerCase()).toContain('inputarea')
  })

  it('component 过滤词参与计分：query 不命中时组件文档仍因 component 入选', async () => {
    // toast 在 input-area.md 中 0 次——入选只可能来自 component 'InputArea' 计分
    const results = await search({ query: 'Toast', component: 'InputArea' })

    const inputArea = results.find(
      (r) => r.source === 'components/input-area.md',
    )
    expect(inputArea).toBeDefined()
    expect(inputArea?.score).toBeGreaterThan(0)
  })

  it('结果按 score 降序排序', async () => {
    const results = await search({ query: '暗色' })

    const scores = results.map((r) => r.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('无命中：返回空数组，不抛错', async () => {
    const results = await search({ query: 'zzz不存在的词qqq' })

    expect(results).toEqual([])
  })

  it('检索词含正则特殊字符：转义后正常执行', async () => {
    await expect(search({ query: 'props (v-model)' })).resolves.toBeInstanceOf(
      Array,
    )
  })
})
