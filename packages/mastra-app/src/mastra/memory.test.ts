import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureDbDir } from './memory'

let tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs = []
})

function tempPath(segments: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mastra-app-test-'))
  tempDirs.push(dir)
  return join(dir, segments)
}

describe('ensureDbDir', () => {
  it('file: URL 为嵌套不存在的目录时创建全部父目录', () => {
    const nested = tempPath(join('deep', 'nested', 'db.sqlite'))
    const url = `file:${nested}`
    ensureDbDir(url)
    const dir = nested.slice(0, nested.lastIndexOf('/'))
    expect(existsSync(dir)).toBe(true)
  })

  it('file: URL 指向当前目录（无目录段）时不抛错', () => {
    expect(() => ensureDbDir('file:plain.db')).not.toThrow()
  })

  it(':memory: 库不触碰文件系统', () => {
    expect(() => ensureDbDir('file::memory:')).not.toThrow()
  })

  it('非 file: 协议（http/turso 远端库）直接跳过', () => {
    expect(() => ensureDbDir('libsql://turso.example.db')).not.toThrow()
  })

  it('空路径安全跳过', () => {
    expect(() => ensureDbDir('file:')).not.toThrow()
  })
})
