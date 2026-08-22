// 复制自 packages/mock-server/src/mastra/tools.ts（spec 12 §3.3：~100 行两份互指来源，
// mock-server 原文件不动、spec 11 的 registerRuntimeProvider 仍在原处 import；
// 工具涨到 3+ 个再议上提公共包）
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
