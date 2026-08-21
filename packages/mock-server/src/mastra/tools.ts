import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/** 本地时间工具：零网络依赖，测试与演示友好 */
export const getTimeTool = createTool({
  id: 'get_time',
  description: '获取指定时区的当前时间；不传 timezone 则用系统本地时间',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA 时区名，如 Asia/Shanghai'),
  }),
  // @mastra/core 1.60 的 execute 签名是 (inputData, executionContext)：
  // 第一参数直接是校验后的输入，不是 { context } 包装
  execute: async ({ timezone }) => {
    const now = new Date()
    const formatted = timezone
      ? now.toLocaleString('zh-CN', { timeZone: timezone })
      : now.toLocaleString('zh-CN')
    return { iso: now.toISOString(), formatted, timezone: timezone ?? 'local' }
  },
})

/** 天气工具：wttr.in 免费接口，5s 超时保护（对齐课程 17-02 方案） */
export const getWeatherTool = createTool({
  id: 'get_weather',
  description: '获取指定城市的当前天气（wttr.in）',
  inputSchema: z.object({
    city: z.string().describe('城市名，如 Beijing'),
  }),
  execute: async ({ city }) => {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      {
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!response.ok) {
      throw new Error(`wttr.in ${response.status}`)
    }
    const data = (await response.json()) as {
      current_condition?: {
        temp_C?: string
        weatherDesc?: { value?: string }[]
      }[]
    }
    const current = data.current_condition?.[0]
    return {
      city,
      temperatureC: current?.temp_C ?? '',
      description: current?.weatherDesc?.[0]?.value ?? '',
    }
  },
})
