import type { ProviderFormPayload } from '@toimc/vue'

/** GET /api/app/model 的公开视图（服务端脱敏，绝不含 apiKey） */
export interface MastraRuntimeConfig {
  name: string
  provider: string
  model: string
  baseURL?: string
}

/** 拉取 4111 的单条运行时模型配置；null = 未配置（服务端不可达抛错，由调用方降级） */
export async function fetchMastraRuntimeModel(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<MastraRuntimeConfig | null> {
  const res = await fetch(`${baseUrl}/api/app/model`, {
    method: 'GET',
    signal,
  })
  if (!res.ok) throw new Error(`mastra-app HTTP ${res.status}`)
  const data = (await res.json()) as { config: MastraRuntimeConfig | null }
  return data.config ?? null
}

/** 表单提交即换模型（免重启）：POST /api/app/model */
export async function saveMastraRuntimeModel(
  baseUrl: string,
  payload: ProviderFormPayload,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/app/model`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`mastra-app HTTP ${res.status}`)
}

/** 清空运行时配置（回到 .env 静态模型）：DELETE /api/app/model */
export async function removeMastraRuntimeModel(baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/app/model`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`mastra-app HTTP ${res.status}`)
}
