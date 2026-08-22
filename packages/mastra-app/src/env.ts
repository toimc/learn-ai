/** mastra-app 环境配置（MASTRA_APP_* 前缀，规避与 mastra CLI 自有 MASTRA_TELEMETRY_DISABLED 撞名，spec 12 §3.4） */
export interface AppEnvConfig {
  /** 模型路由串，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选；设置后 model 走 { id, url } 对象形态） */
  modelUrl?: string
  /** API 访问令牌（可选；设置后 /api/* 需 Bearer，/health 保持公开） */
  token?: string
  /** HTTP 端口（默认 4111，Mastra 生态默认口） */
  port: number
  /** 遥测开关 */
  telemetry: boolean
}

export const DEFAULT_PORT = 4111

/**
 * 解析 MASTRA_APP_* 环境变量；缺 MASTRA_APP_MODEL 抛指明该 env 的可读错误
 * （启动即失败，不等到首个请求才暴露）
 */
export function readAppEnv(
  env: Record<string, string | undefined> = process.env,
): AppEnvConfig {
  const model = env.MASTRA_APP_MODEL
  if (!model) {
    throw new Error(
      '缺少环境变量 MASTRA_APP_MODEL：请在 packages/mastra-app/.env 配置模型路由串（如 deepseek/deepseek-chat），参照 .env.example',
    )
  }
  const parsedPort = Number(env.MASTRA_APP_PORT)
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT
  return {
    model,
    ...(env.MASTRA_APP_MODEL_URL ? { modelUrl: env.MASTRA_APP_MODEL_URL } : {}),
    ...(env.MASTRA_APP_TOKEN ? { token: env.MASTRA_APP_TOKEN } : {}),
    port,
    telemetry: env.MASTRA_APP_TELEMETRY === 'true',
  }
}
