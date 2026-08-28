/** env → Mastra model 字段（spec 12 §3.3）：Mastra 模型层构建在 AI SDK 上，model 支持三种形态 */
export type ResolvedModelConfig =
  string | { id: string; url?: string; apiKey?: string }

/**
 * 有自定义端点走 { id, url, apiKey? } 对象（OpenAI 兼容端点；实测 Mastra 的 url 场景
 * 不自动读 provider 约定 env，中转站密钥须经 MASTRA_MODEL_API_KEY 显式传入对象）；
 * 否则路由串直传（如 'deepseek/deepseek-chat'，Mastra 按 provider/model 路由并读对应 env）
 */
const CHAT_COMPLETIONS_SUFFIX = '/chat/completions'

/**
 * 规范化 OpenAI 兼容端点 URL：Mastra url 场景底层走 AI SDK 的
 * config.url({ path: "/chat/completions" }) **baseURL 拼接模式**——url 应填
 * base 形态（如 https://x.com/v1）。用户容易整段粘贴完整端点，拼后缀会得到
 * /v1/chat/completions/chat/completions → 404 Not Found；此处剥掉误加的后缀
 * 统一归一到 base 形态（尾斜杠一并清理）。
 */
export function normalizeEndpointUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  return trimmed.endsWith(CHAT_COMPLETIONS_SUFFIX)
    ? trimmed.slice(0, -CHAT_COMPLETIONS_SUFFIX.length)
    : trimmed
}

export function resolveModelConfig(config: {
  model: string
  modelUrl?: string
  modelApiKey?: string
}): ResolvedModelConfig {
  return config.modelUrl
    ? {
        id: config.model,
        url: normalizeEndpointUrl(config.modelUrl),
        ...(config.modelApiKey ? { apiKey: config.modelApiKey } : {}),
      }
    : config.model
}
