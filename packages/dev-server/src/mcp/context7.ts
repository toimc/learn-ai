import type { DevServerEnv } from '../env'
import { createMcpTools } from './mcp-tools'

/**
 * context7 装配：docs-agent 查外部库最新文档的工具来源。
 * 仅 mastra 线 + CONTEXT7_API_KEY 存在时才连（stdio npx，对齐官方配置片段形态）；
 * key 缺失或连接失败都降级为空工具集，不影响启动。
 */
export async function loadContext7Tools(
  env: DevServerEnv,
): Promise<Record<string, unknown>> {
  if (!env.mastra || !env.context7ApiKey) return {}
  return createMcpTools({
    name: 'context7',
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', '@upstash/context7-mcp', '--api-key', env.context7ApiKey],
  })
}
