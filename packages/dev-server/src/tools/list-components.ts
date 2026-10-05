import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/** 组件文档目录（与 search-docs 同源：packages/docs/components） */
const COMPONENTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/components',
)

/** kebab 文件名 → Pascal 组件名：prompt-input → PromptInput */
function toPascalName(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * 首段摘要：跳过标题/引用/提示容器行，取第一段正文截 80 字。
 * 引用行（> 开头）承担废弃标记职责（如 "⚠️ 已废弃"），不进摘要。
 */
function extractSummary(content: string): string {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('>')) continue
    if (trimmed.startsWith(':::')) continue
    return trimmed.slice(0, 80)
  }
  return ''
}

export const listComponentsTool = createTool({
  id: 'list_components',
  description:
    '列出 ai-chat-ui 组件库全部组件清单（组件名/摘要/文档路径/废弃标记）。回答"有哪些组件、基础组件、组件列表"等清单类问题必须先用本工具；查具体组件用法再调 search_docs。',
  inputSchema: z.object({}).describe('无需入参'),
  // @mastra/core 1.60 的 execute 签名是 (inputData, executionContext)
  execute: async () => {
    const files = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort()

    const components = files.map((file) => {
      const content = readFileSync(join(COMPONENTS_DIR, file), 'utf-8')
      const head = content.split('\n').slice(0, 10).join('\n')
      return {
        name: toPascalName(file.replace(/\.md$/, '')),
        title: content.match(/^#\s+(.+)$/m)?.[1] ?? file,
        summary: extractSummary(content),
        source: `components/${file}`,
        deprecated: head.includes('已废弃'),
      }
    })

    return { components }
  },
})
