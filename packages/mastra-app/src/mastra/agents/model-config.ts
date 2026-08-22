/** env → Mastra model 字段（spec 12 §3.3）：Mastra 模型层构建在 AI SDK 上，model 支持三种形态 */
export type ResolvedModelConfig = string | { id: string; url: string }

/**
 * 有自定义端点走 { id, url } 对象（OpenAI 兼容端点，密钥仍按 provider 约定读 env）；
 * 否则路由串直传（如 'deepseek/deepseek-chat'，Mastra 按 provider/model 路由）
 */
export function resolveModelConfig(config: {
  model: string
  modelUrl?: string
}): ResolvedModelConfig {
  return config.modelUrl
    ? { id: config.model, url: config.modelUrl }
    : config.model
}
