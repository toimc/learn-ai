import { ref } from 'vue'
import type { Ref } from 'vue'
import { checkHealth } from '../mock/sse-adapter'

/** 后端选择器三选项：local=本地剧本，其余为远端服务 */
export type PlaygroundBackendId = 'local' | 'mock-server' | 'mastra'

export const BACKEND_STORAGE_KEY = 'pg.backend'

const KNOWN_BACKENDS: readonly PlaygroundBackendId[] = [
  'local',
  'mock-server',
  'mastra',
]

/** 远端后端基地址（探活与提示共用） */
export const BACKEND_BASE_URLS = {
  'mock-server': 'http://localhost:8787',
  mastra: 'http://localhost:4111',
} as const

/** 4111 探活超时：ping /api/agents，2s 无响应视为离线 */
const MASTRA_PING_TIMEOUT_MS = 2000

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface UseBackendSelectorOptions {
  /** 注入测试桩；缺省用浏览器 localStorage（SSR/隐私模式读写失败静默降级） */
  storage?: StorageLike
}

function defaultStorage(): StorageLike {
  if (typeof localStorage === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
  return localStorage
}

function safeGet(storage: StorageLike): PlaygroundBackendId {
  try {
    const value = storage.getItem(BACKEND_STORAGE_KEY)
    if (value && (KNOWN_BACKENDS as readonly string[]).includes(value)) {
      return value as PlaygroundBackendId
    }
  } catch {
    // 读取失败回退默认
  }
  return 'local'
}

function safeSet(storage: StorageLike, id: PlaygroundBackendId): void {
  try {
    storage.setItem(BACKEND_STORAGE_KEY, id)
  } catch {
    // 持久化失败不影响会话内选择
  }
}

/** 探活 mastra-app：GET /api/agents（agent 列表端点），2s 超时 */
async function pingMastra(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE_URLS.mastra}/api/agents`, {
      method: 'GET',
      signal: AbortSignal.timeout(MASTRA_PING_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Playground 后端选择器状态（spec 12 §4.3）：本地 Mock / mock-server 8787 / Mastra 4111。
 * 选中 id 持久化 localStorage（pg.backend）；切换远端前探活，不可达不切换并标记离线。
 * 选择只影响新会话（创建时快照进会话，对齐 spec 11 的 model 语义）。
 */
export function useBackendSelector(options: UseBackendSelectorOptions = {}) {
  const storage = options.storage ?? defaultStorage()

  const backend: Ref<PlaygroundBackendId> = ref(safeGet(storage))
  /** null = 未探测 */
  const mockServerOnline: Ref<boolean | null> = ref(null)
  const mastraOnline: Ref<boolean | null> = ref(null)

  async function probeRemote(id: 'mock-server' | 'mastra'): Promise<boolean> {
    const online =
      id === 'mock-server'
        ? await checkHealth(BACKEND_BASE_URLS['mock-server'])
        : await pingMastra()
    if (id === 'mock-server') mockServerOnline.value = online
    else mastraOnline.value = online
    return online
  }

  /** 并行探测两个远端（挂载时初始化离线标记，不改变当前选中） */
  async function probeAll(): Promise<void> {
    await Promise.all([probeRemote('mock-server'), probeRemote('mastra')])
  }

  /** 探活结果为离线（未探测返回 false，不禁用） */
  function isOffline(id: PlaygroundBackendId): boolean {
    if (id === 'mock-server') return mockServerOnline.value === false
    if (id === 'mastra') return mastraOnline.value === false
    return false
  }

  /**
   * 切换后端：远端先探活，不可达返回 false 且保持原选中（重选当前远端项 = 重试探活）。
   */
  async function selectBackend(id: PlaygroundBackendId): Promise<boolean> {
    if (id !== 'local' && !(await probeRemote(id))) return false
    backend.value = id
    safeSet(storage, id)
    return true
  }

  return {
    backend,
    mockServerOnline,
    mastraOnline,
    probeAll,
    selectBackend,
    isOffline,
  }
}
