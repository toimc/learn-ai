import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createTool } from '@mastra/core/tools'

/**
 * MCP 工具适配层（17-01 MCPToolAdapter 的最小落地）：
 * stdio 启动外部 MCP server（npx 形态），listTools 动态发现后包装成 Mastra 工具。
 * @mastra/core 1.60 尚无 MCP Client（新版文档的 Client API 是更高版本特性），
 * 故直接用官方 @modelcontextprotocol/sdk 自建。
 */

/** 命名空间前缀防冲突：多 server 工具混进同一 agent 时 tool 名唯一（对齐 17-01 约定） */
export function mcpToolName(server: string, tool: string): string {
  return `${server}__${tool}`
}

/**
 * 远端 JSON Schema → Standard Schema v1 透传包装：
 * validate 不校验直接放行（真正的校验在 MCP server 端），jsonSchema converter
 * 原样返回远端 schema，供 Mastra 转 LLM 工具参数定义（standardSchemaToJSONSchema 走此路径）。
 */
export function jsonSchemaPassthrough(schema?: Record<string, unknown>) {
  const resolved = schema ?? { type: 'object' }
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'ai-chat-ui-mcp',
      validate: (value: unknown) => ({ value }),
      jsonSchema: {
        // 零参签名可赋给带 options 的 converter 类型（少参兼容）；运行时忽略调用方实参
        input: () => resolved,
        output: () => resolved,
      },
    },
  }
}

export interface McpStdioServerConfig {
  /** server 标识（作为工具名命名空间前缀），如 'context7' */
  name: string
  /** 启动命令，如 'npx' */
  command: string
  args?: string[]
  /** 连接 + 工具发现的总预算 ms，超时降级；默认 60s（首次 npx 下载包较慢） */
  timeoutMs?: number
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} 超时（${ms}ms）`)),
        ms,
      )
    }),
  ]).finally(() => clearTimeout(timer))
}

/**
 * 连接 stdio MCP server 并返回包装后的工具集。
 * 连接/发现失败一律降级为空对象（打 warn 不阻塞启动）；client 由包装工具闭包持有，
 * 生命周期与进程一致——不注册信号钩子，避免与 tsx watch / mastra dev 的重启逻辑打架。
 */
export async function createMcpTools(
  config: McpStdioServerConfig,
): Promise<Record<string, unknown>> {
  const client = new Client({
    name: `ai-chat-ui-${config.name}`,
    version: '1.0.0',
  })
  const transport = new StdioClientTransport({
    command: config.command,
    ...(config.args ? { args: config.args } : {}),
  })
  try {
    const tools = await withTimeout(
      (async () => {
        await client.connect(transport)
        return (await client.listTools()).tools
      })(),
      config.timeoutMs ?? 60_000,
      `MCP ${config.name} 连接/工具发现`,
    )
    return Object.fromEntries(
      tools.map((tool) => {
        const wrapped = createTool({
          id: mcpToolName(config.name, tool.name),
          description:
            tool.description ??
            `MCP server ${config.name} 的 ${tool.name} 工具`,
          inputSchema: jsonSchemaPassthrough(
            tool.inputSchema as Record<string, unknown> | undefined,
          ),
          execute: async (input) => {
            // SDK 返回联合类型（有无 structuredContent 两种形态），收窄到本包装关心的字段
            const result = (await client.callTool({
              name: tool.name,
              arguments: input as Record<string, unknown>,
            })) as {
              content?: Array<{ type: string; text?: string }>
              isError?: boolean
            }
            // 只取文本块（context7 全量文本返回）；非文本块（资源/图片）暂不透出
            const text = (result.content ?? [])
              .filter(
                (block): block is { type: 'text'; text: string } =>
                  block.type === 'text',
              )
              .map((block) => block.text)
              .join('\n\n')
            if (result.isError) {
              throw new Error(text || `MCP 工具 ${tool.name} 调用失败`)
            }
            return { text }
          },
        })
        return [mcpToolName(config.name, tool.name), wrapped]
      }),
    )
  } catch (err) {
    // 半连接状态要关掉子进程再降级
    await client.close().catch(() => {})
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(
      `[mcp] ${config.name} 工具发现失败，本进程降级为不挂载：${reason}`,
    )
    return {}
  }
}
