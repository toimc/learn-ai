/** env → Mastra model 字段（spec 12 §3.3）：Mastra 模型层构建在 AI SDK 上，model 支持三种形态 */
export type ResolvedModelConfig =
  string | { id: string; url: string; apiKey?: string }

/**
 * 有自定义端点走 { id, url, apiKey? } 对象（OpenAI 兼容端点；实测 Mastra 的 url 场景
 * 不自动读 provider 约定 env，中转站密钥须经 MASTRA_APP_MODEL_API_KEY 显式传入对象）；
 * 否则路由串直传（如 'deepseek/deepseek-chat'，Mastra 按 provider/model 路由并读对应 env）
 */
export function resolveModelConfig(config: {
  model: string
  modelUrl?: string
  modelApiKey?: string
}): ResolvedModelConfig {
  return config.modelUrl
    ? {
        id: config.model,
        url: config.modelUrl,
        ...(config.modelApiKey ? { apiKey: config.modelApiKey } : {}),
      }
    : config.model
}
