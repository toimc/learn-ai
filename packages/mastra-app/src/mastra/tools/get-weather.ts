// 复制自 packages/mock-server/src/mastra/tools.ts（spec 12 §3.3：~100 行两份互指来源，
// mock-server 原文件不动、spec 11 的 registerRuntimeProvider 仍在原处 import；
// 工具涨到 3+ 个再议上提公共包）
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

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
