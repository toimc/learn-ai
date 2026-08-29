import { describe, expect, it } from 'vitest'
import { listComponentsTool } from '../../src/tools/list-components'

type ExecuteFn = NonNullable<typeof listComponentsTool.execute>
type ExecuteContext = Parameters<ExecuteFn>[1]

function makeContext(): ExecuteContext {
  return {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    runtimeContext: {},
    observe: { span: async () => ({}), log: () => {} },
    trace: {},
  } as ExecuteContext
}

interface ComponentEntry {
  name: string
  title: string
  summary: string
  source: string
  deprecated: boolean
}

async function listComponents(): Promise<ComponentEntry[]> {
  const fn = listComponentsTool.execute
  if (!fn) throw new Error('list_components execute 未定义')
  const raw = (await fn({}, makeContext())) as { components: ComponentEntry[] }
  return raw.components
}

describe('list_components 工具', () => {
  it('id 与描述：明确"清单类问题先此工具"的路由语义', () => {
    expect(listComponentsTool.id).toBe('list_components')
    expect(listComponentsTool.description).toContain('清单')
    expect(listComponentsTool.description).toContain('search_docs')
  })

  it('无入参：空对象即可执行', async () => {
    const components = await listComponents()
    expect(components.length).toBeGreaterThanOrEqual(20)
  })

  it('清单含已知组件（字面量来自 docs/components 文件系统事实）', async () => {
    const components = await listComponents()
    const names = components.map((c) => c.name)

    expect(names).toContain('Button')
    expect(names).toContain('MessageBubble')
    expect(names).toContain('ChatWindow')
  })

  it('每项携带 Pascal 组件名、标题、摘要与文档路径', async () => {
    const components = await listComponents()
    const button = components.find((c) => c.name === 'Button')

    expect(button?.title).toBe('Button')
    expect(button?.summary.length).toBeGreaterThan(0)
    expect(button?.source).toBe('components/button.md')
  })

  it('废弃组件带 deprecated 标记（MessageBubble 已废弃，迁移 Message）', async () => {
    const components = await listComponents()
    const bubble = components.find((c) => c.name === 'MessageBubble')

    expect(bubble?.deprecated).toBe(true)
  })
})
