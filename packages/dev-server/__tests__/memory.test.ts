import { existsSync, rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createStorage, ensureDbDir } from '../src/memory'

const TMP_DIR = '.tmp-memory-test'

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('ensureDbDir', () => {
  it('file: 前缀自动建父目录（libsql 不建目录会 SQLITE_CANTOPEN 崩启动）', () => {
    ensureDbDir(`file:${TMP_DIR}/sub/db.sqlite`)
    expect(existsSync(`${TMP_DIR}/sub`)).toBe(true)
  })

  it(':memory: 与非 file: URL 不触碰文件系统', () => {
    expect(() => ensureDbDir('file::memory:')).not.toThrow()
    expect(() => ensureDbDir('libsql://remote.example/db')).not.toThrow()
    expect(existsSync(TMP_DIR)).toBe(false)
  })
})

describe('createStorage', () => {
  it('返回 LibSQLStore 实例并预建父目录（Mastra 实例级 storage）', () => {
    const store = createStorage(`file:${TMP_DIR}/storage/mastra.db`)
    expect(store.constructor.name).toBe('LibSQLStore')
    expect(existsSync(`${TMP_DIR}/storage`)).toBe(true)
  })
})
