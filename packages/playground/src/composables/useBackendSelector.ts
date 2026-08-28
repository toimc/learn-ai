import { ref } from 'vue'
import type { Ref } from 'vue'
import { checkHealth } from '../mock/sse-adapter'

/** 后端选择器两选项：local=本地剧本，dev-server=统一服务（mock + mastra agents） */
export type PlaygroundBackendId = 'local' | 'dev-server'

export const BACKEND_STORAGE_KEY = 'pg.backend'

const KNOWN_BACKENDS: readonly PlaygroundBackendId[] = ['local', 'dev-server']

/** 旧值迁移：spec 14 前的三后端值映射（未知值回退 local 安全默认） */
const LEGACY_ALIASES: Record<string, PlaygroundBackendId> = {
  'mock-server': 'dev-server',
  mastra: 'dev-server',
}

/** 远端后端基地址（探活与提示共用） */
export const BACKEND_BASE_URLS = {
  'dev-server': 'http://localhost:8787',
} as const

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
    if (value && value in LEGACY_ALIASES) return LEGACY_ALIASES[value]
  } catch {
    // 读取失败回退默认
  }
  return 'local'
}

function safeSet(storage: StorageLike, id: PlaygroundBackendId) {
  try {
    storage.setItem(BACKEND_STORAGE_KEY, id)
  } catch {
    // 持久化失败不影响会话内选择
  }
}

/**
 * Playground 后端选择器：本地 Mock / dev-server 8787。
 * 选中 id 持久化 localStorage（pg.backend，旧值自动迁移）；切换远端前探活，
 * 不可达不切换并标记离线。选择只影响新会话（创建时快照，对齐 spec 11 语义）。
 */
export function useBackendSelector(options: UseBackendSelectorOptions = {}) {
  const storage = options.storage ?? defaultStorage()

  const backend: Ref<PlaygroundBackendId> = ref(safeGet(storage))
  /** null = 未探测 */
  const serverOnline: Ref<boolean | null> = ref(null)

  async function probeRemote(id: 'dev-server'): Promise<boolean> {
    const online = await checkHealth(BACKEND_BASE_URLS[id])
    serverOnline.value = online
    return online
  }

  /** 探测远端（挂载时初始化离线标记，不改变当前选中） */
  async function probeAll(): Promise<void> {
    await probeRemote('dev-server')
  }

  /** 探活结果为离线（未探测返回 false，不禁用） */
  function isOffline(id: PlaygroundBackendId): boolean {
    if (id === 'dev-server') return serverOnline.value === false
    return false
  }

  /** 切换后端：远端先探活，不可达返回 false 且保持原选中（重选当前远端项 = 重试探活） */
  async function selectBackend(id: PlaygroundBackendId): Promise<boolean> {
    if (id !== 'local' && !(await probeRemote(id))) return false
    backend.value = id
    safeSet(storage, id)
    return true
  }

  return {
    backend,
    serverOnline,
    probeAll,
    selectBackend,
    isOffline,
  }
}
