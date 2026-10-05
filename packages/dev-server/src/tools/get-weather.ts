import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * GenUI schema 最小结构（课程 18-01）：工具结果的 ui 字段是给前端的渲染指令。
 * core 的 UISchema 类型由 genui 分支统一提供，届时替换本定义为 re-export。
 */
interface ToolUISchema {
  type: string
  props: Record<string, unknown>
}

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
    const temperatureC = current?.temp_C ?? ''
    const description = current?.weatherDesc?.[0]?.value ?? ''
    // 原始字段是模型生成回复的依据；ui 是前端渲染指令（weather-card），
    // schema 由工具代码确定性生成，两者并存互不干扰（18-01 实现路径一）
    const ui: ToolUISchema = {
      type: 'weather-card',
      props: {
        city,
        temperatureC: Number(temperatureC) || 0,
        description,
      },
    }
    return {
      city,
      temperatureC,
      description,
      ui,
    }
  },
})
