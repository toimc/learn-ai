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
}

export interface DevServerEnv {
  /** HTTP 端口，默认 8787 */
  port: number
  /** 存在即启用 mastra agents；null = 纯 mock 模式 */
  mastra: MastraEnv | null
  /** Studio 遥测开关（src/mastra/index.ts 消费） */
  telemetry: boolean
  /** 网关 Bearer（可选；/health 保持公开） */
  token?: string
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
        }
      : null,
    telemetry: env.MASTRA_TELEMETRY === 'true',
    ...(env.MASTRA_TOKEN ? { token: env.MASTRA_TOKEN } : {}),
  }
}
