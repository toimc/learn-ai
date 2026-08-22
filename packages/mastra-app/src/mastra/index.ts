import { Mastra } from '@mastra/core'
import { chatAgent } from './agents/chat-agent'

/**
 * 必须是静态命名导出 `export const mastra`：mastra CLI/build 静态分析模块级导出，
 * 工厂函数或模块级 let 赋值 CLI 拿不到（spec 12 §3.1）。
 * 构建期选项必须是直属性（不能用工厂/展开传入，mastra build 提取不到）。
 */
export const mastra = new Mastra({
  agents: { 'chat-agent': chatAgent },
  ...(process.env.MASTRA_APP_TELEMETRY === 'true'
    ? { telemetry: { enabled: true } }
    : {}),
})
