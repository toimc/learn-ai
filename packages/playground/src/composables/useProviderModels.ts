import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ProviderFormPayload, ProviderOption } from '@toimc/vue'
import { httpErrorMessage } from '../mock/sse-adapter'

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

/**
 * 「记住配置」的 provider 表单持久化键（Playground 私有决策：私有演示包，
 * 为跨服务重启保留完整配置含 apiKey；发布组件不落任何存储，勾选状态经
 * payload.persist 交宿主决定）。服务端 registry 是进程内存态，重启归零，
 * 启动时按此存储逐条静默重注册即可恢复。
 */
export const SAVED_PROVIDERS_STORAGE_KEY = 'ai-chat-playground:saved-providers'

type SavedProvider = Omit<ProviderFormPayload, 'persist'>

function readSavedProviders(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): SavedProvider[] {
  try {
    const raw = storage.getItem(SAVED_PROVIDERS_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeSavedProviders(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  list: SavedProvider[],
): void {
  try {
    storage.setItem(SAVED_PROVIDERS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 持久化失败不影响会话内使用
  }
}

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
  if (!res.ok) throw new Error(await httpErrorMessage(res))
  return (await res.json()) as T
}

/**
 * 运行时模型与 Provider 状态：拉取 GET /api/models、/api/providers，
 * 探测 dev-server 在线态；选中模型 id 持久化到 localStorage（仅 id）。
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
      // 服务端 registry 是进程内存态（重启归零），浏览器持久化的选中 id 可能已成幽灵值；
      // 失效即回退默认，避免把 unknown model 发给服务端换来 HTTP 400
      if (
        selectedModelId.value &&
        !models.value.some((m) => m.id === selectedModelId.value)
      ) {
        selectModel(undefined)
      }
    } catch {
      status.value = 'offline'
    }
  }

  /** POST /api/providers 注册运行时模型，成功后刷新两份列表并自动选中（添加即使用） */
  async function createProvider(
    payload: ProviderFormPayload,
  ): Promise<ProviderOption> {
    const option = await postProvider(payload)
    if (payload.persist !== false) {
      const rest = { ...payload } as SavedProvider
      delete rest.persist
      writeSavedProviders(storage, [...readSavedProviders(storage), rest])
    }
    await refresh()
    selectModel(option.id)
    return option
  }

  /** 表单 → 服务端注册（恢复流程复用，不走选中与持久化副作用） */
  async function postProvider(
    payload: ProviderFormPayload,
  ): Promise<ProviderOption> {
    const res = await fetch(`${baseUrl}/api/providers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await httpErrorMessage(res))
    return (await res.json()) as ProviderOption
  }

  /** PUT /api/providers/:id 原位更新（id 沿用），成功后联动替换持久化条目并刷新列表 */
  async function updateProvider(
    id: string,
    payload: ProviderFormPayload,
  ): Promise<ProviderOption> {
    const res = await fetch(`${baseUrl}/api/providers/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await httpErrorMessage(res))
    const option = (await res.json()) as ProviderOption
    // 持久化条目按「编辑前的注册项」三元组定位（providers 列表此时还是旧值）
    const before = providers.value.find((p) => p.id === id)
    if (before) {
      const saved = readSavedProviders(storage)
      const idx = saved.findIndex(
        (s) =>
          s.name === before.name &&
          s.provider === before.provider &&
          s.model === before.model,
      )
      if (idx !== -1) {
        const rest = { ...payload } as SavedProvider
        delete rest.persist
        if (payload.persist !== false) saved[idx] = rest
        else saved.splice(idx, 1)
        writeSavedProviders(storage, saved)
      }
    }
    await refresh()
    return option
  }

  /** DELETE /api/providers/:id 注销，成功后刷新两份列表并联动移除持久化配置 */
  async function removeProvider(id: string): Promise<void> {
    const res = await fetch(`${baseUrl}/api/providers/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(await httpErrorMessage(res))
    // 服务端注册项无 apiKey/baseURL，按 name/provider/model 三元组匹配移除
    // 持久化条目（服务重启后 id 会重排，不能按 id 对账）
    const removed = providers.value.find((p) => p.id === id)
    if (removed) {
      const saved = readSavedProviders(storage)
      const idx = saved.findIndex(
        (s) =>
          s.name === removed.name &&
          s.provider === removed.provider &&
          s.model === removed.model,
      )
      if (idx !== -1) {
        saved.splice(idx, 1)
        writeSavedProviders(storage, saved)
      }
    }
    await refresh()
  }

  /**
   * 启动恢复：读持久化配置 → 逐条静默重注册（服务端重启后 registry 归零）。
   * 单条失败（配置失效/服务端校验不过）剔除该条不中断整体；无论有无存储
   * 条目、注册成败，最后都刷新列表（兼作初始化加载入口）。
   */
  async function restoreSavedProviders(): Promise<void> {
    const saved = readSavedProviders(storage)
    const alive: SavedProvider[] = []
    for (const item of saved) {
      try {
        await postProvider(item)
        alive.push(item)
      } catch {
        // 静默剔除失效配置
      }
    }
    if (saved.length > 0) writeSavedProviders(storage, alive)
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
    updateProvider,
    removeProvider,
    restoreSavedProviders,
    selectModel,
  }
}
