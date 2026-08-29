import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MastraCompositeStore } from '@mastra/core/storage'
import type { StorageDomains } from '@mastra/core/storage'
import { DuckDBStore } from '@mastra/duckdb'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

/**
 * 从起始目录向上找本包（@toimc/dev-server）的 package.json 所在目录。
 * 必要性：mastra dev 是 bundle 运行——本模块被内联进 .mastra/output/ 的产物里，
 * ① 目录层级与 src/ 不同，模块锚定会漂移；② **rebuild 会清空 .mastra/ 整个目录**，
 * 锚在其下的库随重启陪葬（Studio 历史反复丢失的根因）。
 * 以包名做标记上溯：bundle 内层的 package.json（name "server"）会被跳过，
 * 最终稳定命中包根，与 tsx / vitest 直跑（src/ 上一级）殊途同归。
 */
function resolvePkgRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        if (
          JSON.parse(readFileSync(pkgPath, 'utf8')).name === '@toimc/dev-server'
        ) {
          return dir
        }
      } catch {
        // 非法 JSON 视为非目标，继续上溯
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return startDir // 到根仍未命中：兜底旧行为（模块目录）
    dir = parent
  }
}

/** 落盘位置：包根 .temp/（.gitignore 任意层级；网关与 Studio 殊途同归同一文件） */
const PKG_TEMP_DIR = join(
  resolvePkgRoot(dirname(fileURLToPath(import.meta.url))),
  '.temp',
)

/** 会话记忆落盘位置（包内 .temp/dev-server.db；tsx / vitest / mastra dev 位置一致） */
const MEMORY_DB_URL = `file:${join(PKG_TEMP_DIR, 'dev-server.db')}`

/**
 * Mastra 实例级存储与 memory 同库：1.60 的 memory REST API（Studio 线程列表/
 * 历史消息的数据源）从实例 storage 读线程，分库会造成写(dev-server.db)读
 * (mastra.db) split-brain——Studio 对话落地却查不到历史。traces / workflow
 * 状态与记忆表同文件共存，本地 dev 便利优先于文件级分离。
 */
const STORAGE_DB_URL = MEMORY_DB_URL

/**
 * 可观测性数据（traces/logs/metrics）落盘位置：与会话库分文件、分引擎。
 * 观测域用 DuckDB 而非 LibSQL：@mastra/libsql 1.21.x 未实现 batchCreateLogs
 * （core 默认只警告不写，logs 落不了库），DuckDB 是官方 quickstart 的本地
 * 推荐组合（LibSQL 主库 + DuckDB 观测域），附带 metrics 聚合能力。
 * 独立文件的意义：删 observability.duckdb 重置演示数据不伤会话历史。
 */
const OBSERVABILITY_DUCKDB_PATH = join(PKG_TEMP_DIR, 'observability.duckdb')

/** libsql 本地文件模式不自动建父目录，目录缺失时 SQLITE_CANTOPEN 直接崩启动 */
export function ensureDbDir(url: string): void {
  if (!url.startsWith('file:')) return
  const path = url.slice('file:'.length)
  if (!path || path === ':memory:') return
  mkdirSync(dirname(path), { recursive: true })
}

/** 默认记忆存储：本地 LibSQL 文件库，进程重启对话保留 */
export function createMemory(dbUrl: string = MEMORY_DB_URL): Memory {
  ensureDbDir(dbUrl)
  return new Memory({
    storage: new LibSQLStore({ id: 'dev-server-memory', url: dbUrl }),
  })
}

/** Mastra 实例级 storage：traces 持久化等，进程重启保留 */
export function createStorage(dbUrl: string = STORAGE_DB_URL): LibSQLStore {
  ensureDbDir(dbUrl)
  return new LibSQLStore({ id: 'dev-server-storage', url: dbUrl })
}

/** composite storage 的可选注入项（测试用临时目录/域替身，避免污染真实 .temp 与加载 DuckDB 原生模块） */
export interface CompositeStorageOptions {
  defaultDbUrl?: string
  /** 观测域实例替身（结构兼容 core 的 ObservabilityStorage，LibSQL/DuckDB 域均可） */
  observabilityDomain?: StorageDomains['observability']
}

/**
 * 默认观测域：DuckDB（官方 quickstart 本地推荐）。async 因域实例经
 * `getStore('observability')` 异步取出；ensureDbDir 先跑——.temp 目录
 * 已存在后再初始化 DuckDB，避免原生模块对缺失目录报错。
 */
async function createDuckDbObservabilityDomain(): Promise<
  StorageDomains['observability']
> {
  const duckdb = new DuckDBStore({
    id: 'dev-server-observability',
    path: OBSERVABILITY_DUCKDB_PATH,
  })
  const domain = await duckdb.getStore('observability')
  if (!domain) {
    throw new Error(
      'DuckDBStore 未提供 observability 域（@mastra/duckdb 版本异常）',
    )
  }
  return domain
}

/**
 * Studio 线 Mastra 实例级 storage：双域路由 composite——default 域（会话/
 * threads/workflow 等）走 LibSQL 的 dev-server.db（会话数据动不得），
 * observability 域（traces/logs/metrics）走独立 DuckDB 文件。domains 里放
 * 的是域实例，composite 的 init 会先跑 default 父 store 再单独 init 未
 * 覆盖域。
 */
export async function createCompositeStorage(
  options: CompositeStorageOptions = {},
): Promise<MastraCompositeStore> {
  const defaultDbUrl = options.defaultDbUrl ?? STORAGE_DB_URL
  ensureDbDir(defaultDbUrl)
  const defaultStore = new LibSQLStore({
    id: 'dev-server-storage',
    url: defaultDbUrl,
  })
  const observabilityDomain =
    options.observabilityDomain ?? (await createDuckDbObservabilityDomain())
  return new MastraCompositeStore({
    id: 'dev-server-composite',
    default: defaultStore,
    domains: { observability: observabilityDomain },
  })
}
