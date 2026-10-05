import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { getWeatherTool } from '../../src/tools/get-weather'

/** createTool 传入的 inputSchema 就是 zod v4 实例（联合类型收窄有依据） */
const schema = getWeatherTool.inputSchema as z.ZodType

type ExecuteFn = NonNullable<typeof getWeatherTool.execute>
type ExecuteContext = Parameters<ExecuteFn>[1]

/** 最小执行上下文替身：get_weather 不消费 observe/trace */
function makeContext(): ExecuteContext {
  return {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    runtimeContext: {},
    observe: { span: async () => ({}), log: () => {} },
    trace: {},
  } as ExecuteContext
}

/** wttr.in ?format=j1 的最小响应形态 */
function wttrResponse(temp_C: string, description: string): Response {
  return new Response(
    JSON.stringify({
      current_condition: [{ temp_C, weatherDesc: [{ value: description }] }],
    }),
    { status: 200 },
  )
}

async function execute(city: string): Promise<Record<string, unknown>> {
  const fn = getWeatherTool.execute
  if (!fn) throw new Error('get_weather execute 未定义')
  return (await fn({ city }, makeContext())) as Record<string, unknown>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('get_weather 工具', () => {
  it('id 与描述符合 spec', () => {
    expect(getWeatherTool.id).toBe('get_weather')
    expect(getWeatherTool.description).toContain('天气')
  })

  it('inputSchema：city 必填，缺失校验失败', () => {
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('inputSchema：合法 city 通过', () => {
    expect(schema.safeParse({ city: 'Beijing' }).success).toBe(true)
  })
})

describe('get_weather execute（mock wttr.in）', () => {
  it('返回值附 weather-card ui schema：原始字段供模型回复，props 数字化温度', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => wttrResponse('22', 'Sunny')),
    )
    expect(await execute('Beijing')).toEqual({
      city: 'Beijing',
      temperatureC: '22',
      description: 'Sunny',
      ui: {
        type: 'weather-card',
        props: { city: 'Beijing', temperatureC: 22, description: 'Sunny' },
      },
    })
  })

  it('temp_C 缺失时 ui.temperatureC 兜底 0，原始字段保持空串', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => wttrResponse('', '')),
    )
    expect(await execute('Nowhere')).toEqual({
      city: 'Nowhere',
      temperatureC: '',
      description: '',
      ui: {
        type: 'weather-card',
        props: { city: 'Nowhere', temperatureC: 0, description: '' },
      },
    })
  })

  it('上游非 2xx 抛含状态码的可读错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('busy', { status: 503 })),
    )
    await expect(execute('Beijing')).rejects.toThrow('wttr.in 503')
  })
})
