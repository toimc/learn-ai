import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 检索语料根：packages/docs（组件用法文档：components/ + guide/ 等）。
 * fileURLToPath(import.meta.url) 而非 import.meta.dirname：vitest 与 tsx 下行为一致。
 */
export const DOCS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs',
)

/** 递归收集 md 文件（跳过隐藏目录 / node_modules / dist 产物） */
export function collectMdFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist'
    )
      continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectMdFiles(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}
