import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

/**
 * 落盘位置锚定模块自身而非 cwd：mastra CLI 内部会 chdir（实测 dev 模式下
 * cwd 漂到 src/mastra/public），相对路径 file:.temp/... 会让两个库散落不同目录。
 * 本文件位于 <pkg>/src/，上一级即包根；.temp/ 在 .gitignore（任意层级）。
 */
const PKG_TEMP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../.temp')

/** 会话记忆落盘位置（包内 .temp/dev-server.db；tsx / vitest / mastra dev 位置一致） */
const MEMORY_DB_URL = `file:${join(PKG_TEMP_DIR, 'dev-server.db')}`

/** Mastra 实例级存储落盘位置（traces / workflow 状态，与 memory 库分开） */
const STORAGE_DB_URL = `file:${join(PKG_TEMP_DIR, 'mastra.db')}`

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
