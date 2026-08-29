import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * 检索范围是 packages/docs（组件用法文档：components/ + guide/）。
 * fileURLToPath(import.meta.url) 而非 import.meta.dirname：vitest 与 tsx 下行为一致。
 */
const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../docs')

/** 递归收集 md 文件（跳过隐藏目录 / node_modules / dist 产物） */
function collectMdFiles(dir: string): string[] {
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

/** 正则特殊字符转义：检索词按字面匹配，不当模式解析 */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const searchDocsTool = createTool({
  id: 'search_docs',
  description:
    '检索 ai-chat-ui 组件库文档。适用于：组件用法、props/events/slots 查询、主题定制、集成配置、报错排查。输入组件名或关键词，返回最相关的文档片段与出处。',
  inputSchema: z.object({
    query: z
      .string()
      .describe('检索词：组件名（如 InputArea）或关键词（如 暗色模式 主题）'),
    component: z.string().optional().describe('限定组件名时填写，提高命中率'),
  }),
  // @mastra/core 1.60 的 execute 签名是 (inputData, executionContext)
  execute: async ({ query, component }) => {
    const files = collectMdFiles(DOCS_ROOT)
    const scored: Array<{
      source: string
      title: string
      snippet: string
      score: number
    }> = []
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lower = content.toLowerCase()
      let score = 0
      for (const term of component ? [component, query] : [query]) {
        const t = escapeRegExp(term.toLowerCase())
        score += (lower.match(new RegExp(t, 'g')) ?? []).length
      }
      if (score === 0) continue
      // 命中位置附近截 400 字作片段；query 字面未命中（仅 component 计分）时从头截取
      const idx = lower.indexOf(query.toLowerCase())
      const start = Math.max(0, idx - 100)
      scored.push({
        source: relative(DOCS_ROOT, file),
        title: content.match(/^#\s+(.+)$/m)?.[1] ?? file,
        snippet: content.slice(start, start + 400),
        score,
      })
    }
    return { results: scored.sort((a, b) => b.score - a.score).slice(0, 5) }
  },
})
