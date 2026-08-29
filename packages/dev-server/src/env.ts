/** dev-server 环境配置（spec 14 §5.4：两套 MASTRA_* 前缀统一为一套） */
export interface MastraEnv {
  /** 模型路由串，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选） */
  modelUrl?: string
  /** 自定义端点的 API key（url 场景必传：Mastra url 场景不自动读 provider env） */
  modelApiKey?: string
  /** 展示名（可选） */
  modelName?: string
  /** 检索等高频轻活用的次级模型（可选；配置则 researcher 用它，演示按角色选模型） */
  subModel?: string
}

export interface DevServerEnv {
  /** HTTP 端口，默认 8787 */
  port: number
  /** 存在即启用 mastra agents；null = 纯 mock 模式 */
  mastra: MastraEnv | null
  /** Studio 可观测性开关（默认开启 opt-out，仅 MASTRA_TELEMETRY=false 显式关闭；src/mastra/index.ts 消费） */
  observability: boolean
  /** 网关 Bearer（可选；/health 保持公开） */
  token?: string
  /** context7 MCP 的 API key（可选；docs-agent 外部库文档工具，src/mcp/context7.ts 消费） */
  context7ApiKey?: string
}

export function readDevServerEnv(
  env: Record<string, string | undefined> = process.env,
): DevServerEnv {
  const parsedPort = Number(env.DEV_SERVER_PORT)
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8787
  const model = env.MASTRA_MODEL
  return {
    port,
    mastra: model
      ? {
          model,
          ...(env.MASTRA_MODEL_URL ? { modelUrl: env.MASTRA_MODEL_URL } : {}),
          ...(env.MASTRA_MODEL_API_KEY
            ? { modelApiKey: env.MASTRA_MODEL_API_KEY }
            : {}),
          ...(env.MASTRA_MODEL_NAME
            ? { modelName: env.MASTRA_MODEL_NAME }
            : {}),
          ...(env.MASTRA_SUB_MODEL ? { subModel: env.MASTRA_SUB_MODEL } : {}),
        }
      : null,
    observability: env.MASTRA_TELEMETRY !== 'false',
    ...(env.MASTRA_TOKEN ? { token: env.MASTRA_TOKEN } : {}),
    ...(env.CONTEXT7_API_KEY ? { context7ApiKey: env.CONTEXT7_API_KEY } : {}),
  }
}
