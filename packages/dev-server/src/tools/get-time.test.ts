import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { getTimeTool } from './get-time'

/** createTool 传入的 inputSchema 就是 zod v4 实例（联合类型收窄有依据） */
const schema = getTimeTool.inputSchema as z.ZodType

type ExecuteFn = NonNullable<typeof getTimeTool.execute>
type ExecuteContext = Parameters<ExecuteFn>[1]

/**
 * 最小执行上下文测试替身：get_time 逻辑只读 timezone 输入，
 * observe/trace 的方法不被触达，空实现即满足结构约束
 */
function makeContext(): ExecuteContext {
  return {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    runtimeContext: {},
    observe: { span: async () => ({}), log: () => {} },
    trace: {},
  } as ExecuteContext
}

/** 调用 execute（存在性守卫替代非空断言） */
function executeTime(input: Parameters<ExecuteFn>[0]) {
  const fn = getTimeTool.execute
  if (!fn) throw new Error('get_time execute 未定义')
  return fn(input, makeContext())
}

describe('get_time 工具', () => {
  it('id 与描述符合 spec（前端工具面板展示来源）', () => {
    expect(getTimeTool.id).toBe('get_time')
    expect(getTimeTool.description).toContain('时间')
  })

  it('inputSchema：timezone 可选，空对象校验通过', () => {
    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ timezone: 'Asia/Shanghai' }).success).toBe(true)
  })

  it('execute 无 timezone：返回本地时间的 iso 与 local 标记', async () => {
    const before = new Date()
    const result = (await executeTime({})) as {
      iso: string
      timezone: string
    }

    expect(result.timezone).toBe('local')
    // iso 是合法时间且不早于调用前一刻
    expect(new Date(result.iso).getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    )
  })

  it('execute 指定 Asia/Shanghai：返回带时区名与可读格式化', async () => {
    const result = (await executeTime({ timezone: 'Asia/Shanghai' })) as {
      iso: string
      formatted: string
      timezone: string
    }

    expect(result.timezone).toBe('Asia/Shanghai')
    expect(result.formatted.length).toBeGreaterThan(0)
  })
})
