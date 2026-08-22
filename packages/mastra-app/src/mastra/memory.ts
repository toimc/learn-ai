import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

/**
 * 会话记忆落盘位置（相对 mastra-app 包目录；.temp/ 已在 .gitignore）。
 * 与 mock-server 的 .temp/mastra.db 显式异名：两服务 CWD 不同天然是两个文件，
 * 异名根除 SQLITE_BUSY 与 thread 混库（spec 12 §3.3）
 */
const MEMORY_DB_URL = 'file:.temp/mastra-app.db'

/** libsql 本地文件模式不自动建父目录，目录缺失时 SQLITE_CANTOPEN 直接崩启动（坑来自 mock-server 实测） */
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
    storage: new LibSQLStore({ id: 'mastra-app-memory', url: dbUrl }),
  })
}
