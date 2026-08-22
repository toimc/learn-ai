import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { getWeatherTool } from './get-weather'

/** createTool 传入的 inputSchema 就是 zod v4 实例（联合类型收窄有依据）；execute 走外网不实测 */
const schema = getWeatherTool.inputSchema as z.ZodType

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
