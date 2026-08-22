import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ProviderFormPayload, ProviderOption } from '@toimc/vue'

/** GET /api/models 的公开视图（与 @toimc/agents ModelPublicInfo 对齐，脱敏无密钥） */
export interface ProviderModelInfo {
  id: string
  name: string
  description: string
  provider?: string
}

export type ProviderServerStatus = 'connecting' | 'online' | 'offline'

/** localStorage 只持久化模型 id，绝写入 apiKey 等任何密钥 */
export const SELECTED_MODEL_STORAGE_KEY = 'ai-chat-playground:selected-model'

interface UseProviderModelsOptions {
  baseUrl?: string
  /** 注入测试桩；缺省用浏览器 localStorage（SSR/隐私模式下读写失败静默降级） */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

const DEFAULT_BASE_URL = 'http://localhost:8787'

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
  return localStorage
}

function safeGet(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  try {
    const value = storage.getItem(SELECTED_MODEL_STORAGE_KEY)
    return value && value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

function safeSet(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  id: string | undefined,
) {
  try {
    if (id) storage.setItem(SELECTED_MODEL_STORAGE_KEY, id)
    else storage.removeItem(SELECTED_MODEL_STORAGE_KEY)
  } catch {
    // 持久化失败不影响会话内选择
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`mock-server HTTP ${res.status}`)
  return (await res.json()) as T
}

/**
 * 运行时模型与 Provider 状态：拉取 GET /api/models、/api/providers，
 * 探测 mock-server 在线态；选中模型 id 持久化到 localStorage（仅 id）。
 * 各状态为独立 ref，同一页面可多次调用共享同一 storage。
 */
export function useProviderModels(options: UseProviderModelsOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const storage = options.storage ?? defaultStorage()

  const models: Ref<ProviderModelInfo[]> = ref([])
  const providers: Ref<ProviderOption[]> = ref([])
  const status: Ref<ProviderServerStatus> = ref('connecting')
  const selectedModelId: Ref<string | undefined> = ref(safeGet(storage))

  /** 拉取模型与 provider 列表；不可达时进入离线态（不抛错） */
  async function refresh(): Promise<void> {
    try {
      const [modelsRes, providersRes] = await Promise.all([
        getJson<{ models: ProviderModelInfo[] }>(`${baseUrl}/api/models`),
        getJson<{ providers: ProviderOption[] }>(`${baseUrl}/api/providers`),
      ])
      models.value = modelsRes.models
      providers.value = providersRes.providers
      status.value = 'online'
    } catch {
      status.value = 'offline'
    }
  }

  /** POST /api/providers 注册运行时模型，成功后刷新两份列表 */
  async function createProvider(
    payload: ProviderFormPayload,
  ): Promise<ProviderOption> {
    const res = await fetch(`${baseUrl}/api/providers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`mock-server HTTP ${res.status}`)
    const option = (await res.json()) as ProviderOption
    await refresh()
    return option
  }

  /** DELETE /api/providers/:id 注销，成功后刷新两份列表 */
  async function removeProvider(id: string): Promise<void> {
    const res = await fetch(`${baseUrl}/api/providers/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`mock-server HTTP ${res.status}`)
    await refresh()
  }

  /** 选中模型（undefined = 回到默认本地 mock 行为），仅持久化 id */
  function selectModel(id: string | undefined): void {
    selectedModelId.value = id
    safeSet(storage, id)
  }

  return {
    models,
    providers,
    status,
    selectedModelId,
    refresh,
    createProvider,
    removeProvider,
    selectModel,
  }
}
