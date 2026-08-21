import { Mastra } from '@mastra/core'
import type { Agent } from '@mastra/core/agent'

/**
 * MASTRA_TELEMETRY=true 时由 app 装配流程写入 agents；
 * npx mastra dev 读取 Mastra 实例起 Studio（默认 4111 端口）。
 */
export let mastraInstance: Mastra | null = null

export function attachMastraInstance(agents: Record<string, Agent>) {
  mastraInstance = new Mastra({
    agents,
    ...(process.env.MASTRA_TELEMETRY === 'true'
      ? { telemetry: { enabled: true } }
      : {}),
  })
  return mastraInstance
}
