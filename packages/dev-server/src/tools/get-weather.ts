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
