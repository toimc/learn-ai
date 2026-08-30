import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { readDevServerEnv } from '../env'
import { collectMdFiles, DOCS_ROOT } from '../rag/docs-corpus'
import { createEmbedder } from '../rag/embedder'
import type { FusionCandidate } from '../rag/fusion'
import { rrfFuse } from '../rag/fusion'
import { createDocsVectorStore, DOCS_INDEX_NAME } from '../rag/vector-store'

/**
 * 领域同义词表：用户口语 → 文档词汇的映射层。
 * 文档词汇收敛（"消息气泡/bubble"），用户口语发散（"聊天气泡"），
 * 字面匹配跨不过这道沟——实测"聊天气泡"在 45 篇文档中出现 0 次。
 * 清单跟着真实失败案例长，不预先铺满。
 */
const SYNONYMS: Record<string, readonly string[]> = {
  聊天气泡: ['气泡', '消息气泡', 'bubble', 'message-bubble'],
  气泡: ['聊天气泡', '消息气泡', 'bubble', 'message-bubble'],
  消息气泡: ['聊天气泡', '气泡', 'bubble', 'message-bubble'],
  暗色: ['深色', '夜间', 'dark'],
  深色: ['暗色', '夜间', 'dark'],
  夜间: ['暗色', '深色', 'dark'],
  主题: ['换肤', '皮肤', 'theme'],
  换肤: ['主题', '皮肤', 'theme'],
  皮肤: ['主题', '换肤', 'theme'],
  圆角: ['radius'],
  输入框: ['input', 'input-area', 'prompt-input'],
  消息列表: ['message-list'],
  弹窗: ['dialog', 'modal', 'toast'],
  提示: ['toast'],
  附件: ['attachment', '上传'],
  上传: ['attachment', '附件'],
  图片: ['image', 'lightbox'],
  预览: ['lightbox', 'image'],
  国际化: ['i18n', '多语言', 'locale'],
  多语言: ['i18n', '国际化', 'locale'],
  流式: ['stream', 'stream-text'],
  思维链: ['thinking', 'reasoning'],
  工具调用: ['tool-call'],
}

/** 正则特殊字符转义：检索词按字面匹配，不当模式解析 */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countMatches(haystack: string, term: string): number {
  return (haystack.match(new RegExp(escapeRegExp(term), 'g')) ?? []).length
}

/** 入参关键词展开为检索词项：元素内再按空白拆（防"Button Input"整元素），去重 */
function expandKeywords(keywords: string[], component?: string): string[] {
  const raw = [...keywords, ...(component ? [component] : [])]
    .flatMap((k) => k.trim().split(/\s+/))
    .filter(Boolean)
  return [...new Set(raw)]
}

interface DocIndexEntry {
  source: string
  title: string
  titleText: string
  lowerBody: string
  snippetSource: string
}

/** 每次执行全量读盘（47 篇文档 <1MB，dev 工具无需索引常驻） */
function buildIndex(): DocIndexEntry[] {
  return collectMdFiles(DOCS_ROOT).map((file) => {
    const content = readFileSync(file, 'utf-8')
    const headingLines = content
      .split('\n')
      .filter((line) => /^#{1,3}\s+/.test(line))
    return {
      source: relative(DOCS_ROOT, file),
      title: content.match(/^#\s+(.+)$/m)?.[1] ?? file,
      // 标题命中是最强信号：一级到三级标题行合并参与加权
      titleText: headingLines.join('\n').toLowerCase(),
      lowerBody: content.toLowerCase(),
      snippetSource: content,
    }
  })
}

const HINT_NO_HIT =
  '未命中任何文档。建议：1) 调 list_components 查看全部组件清单；2) 换组件英文名（如 MessageBubble）或常用术语（如 主题、暗色、i18n）重试'

/** 向量路召回深度：融合前取 top8（同 source 多块取最高分），RRF 后再截 top5 */
const VECTOR_TOP_K = 8
/** cosine 相似度门槛：低于此分的无关块直接滤掉（bge-m3 实测无关块 < 0.3） */
const VECTOR_MIN_SCORE = 0.35

/**
 * 语义检索路：查询文本 → embedding → LibSQLVector topK 召回。
 * EMBEDDING_MODEL 未配置返回空；任何失败（端点不可达/索引未建/维度不符）
 * 由调用方 catch 降级纯关键词——工具永不因向量路崩。
 */
async function retrieveVectorHits(
  queryText: string,
): Promise<FusionCandidate[]> {
  const env = readDevServerEnv()
  if (!env.embedding) return []

  const embedder = createEmbedder(env.embedding)
  const store = createDocsVectorStore()
  const { embeddings } = await embedder.doEmbed({ values: [queryText] })
  const hits = await store.query({
    indexName: DOCS_INDEX_NAME,
    queryVector: embeddings[0]!,
    topK: VECTOR_TOP_K,
    minScore: VECTOR_MIN_SCORE,
  })

  // query 已按相似度降序：同 source 首个命中即该文档最高分块
  const best = new Map<string, (typeof hits)[number]>()
  for (const hit of hits) {
    const source = String(hit.metadata?.source ?? '')
    if (!source || best.has(source)) continue
    best.set(source, hit)
  }
  return [...best.values()].map((hit) => ({
    source: String(hit.metadata?.source),
    title: String(hit.metadata?.title ?? ''),
    snippet: String(hit.metadata?.text ?? '').slice(0, 400),
    score: hit.score,
    matchedTerms: [],
  }))
}

export const searchDocsTool = createTool({
  id: 'search_docs',
  description:
    '检索 ai-chat-ui 组件库文档（语义+关键词混合）。适用于：组件用法、props/events/slots 查询、主题定制、集成配置、报错排查。keywords 给 1-3 个关键词（优先组件英文名如 MessageBubble；语义检索已支持自然短语，如「聊天气泡怎么改圆角」），返回最相关的文档片段与出处。清单类问题（有哪些组件/基础组件）请改用 list_components。',
  inputSchema: z.object({
    keywords: z
      .array(z.string().min(1))
      .min(1)
      .describe('检索关键词数组：每元素一个词（组件名或主题词），不要整句'),
    component: z.string().optional().describe('限定组件名时填写，提高命中率'),
  }),
  // @mastra/core 1.60 的 execute 签名是 (inputData, executionContext)
  execute: async ({ keywords, component }, context) => {
    const terms = expandKeywords(keywords ?? [], component)
    if (terms.length === 0) {
      return { results: [], hint: HINT_NO_HIT }
    }

    const index = buildIndex()
    const lowerTerms = terms.map((t) => t.toLowerCase())

    // 文档频率 → IDF：常见词（"组件""使用"）降权，让稀有术语主导相关性
    const docFreq = new Map<string, number>()
    for (const term of lowerTerms) {
      const variants = [term, ...(SYNONYMS[term] ?? [])]
      docFreq.set(
        term,
        index.filter(
          (doc) =>
            variants.some((v) => doc.lowerBody.includes(v)) ||
            doc.titleText.includes(term),
        ).length,
      )
    }

    const scored: Array<{
      source: string
      title: string
      snippet: string
      score: number
      matchedTerms: string[]
    }> = []

    for (const doc of index) {
      let score = 0
      const matchedTerms: string[] = []
      const hitPositions: number[] = []

      for (const term of lowerTerms) {
        const variants = [term, ...(SYNONYMS[term] ?? [])]
        let titleTf = 0
        let bodyTf = 0
        for (const variant of variants) {
          titleTf += countMatches(doc.titleText, variant)
          bodyTf += countMatches(doc.lowerBody, variant)
          const idx = doc.lowerBody.indexOf(variant)
          if (idx >= 0) hitPositions.push(idx)
        }
        if (titleTf + bodyTf === 0) continue

        const df = docFreq.get(term) ?? 0
        const idf = Math.log(1 + index.length / (1 + df))
        // 标题命中 ×5：正文里的高频引用不得压过标题命中（实测查 ChatWindow
        // 时 message-bubble.md 因正文引用 6 次反超 chat-window.md 的标题命中）
        score += idf * (titleTf * 5 + bodyTf)
        matchedTerms.push(term)
      }

      if (score === 0 || matchedTerms.length === 0) continue

      // 片段：最早命中变体位置前 100 字起截 400 字（仅标题命中时从头截）
      const firstHit = hitPositions.length > 0 ? Math.min(...hitPositions) : 0
      const start = Math.max(0, firstHit - 100)
      scored.push({
        source: doc.source,
        title: doc.title,
        snippet: doc.snippetSource.slice(start, start + 400),
        score: Math.round(score * 100) / 100,
        matchedTerms,
      })
    }

    const keywordResults = scored.sort((a, b) => b.score - a.score).slice(0, 5)

    // 向量路：EMBEDDING_MODEL 配置时语义召回，失败降级纯关键词（不崩、不静默丢日志）
    let vectorHits: FusionCandidate[] = []
    try {
      vectorHits = await retrieveVectorHits(terms.join(' '))
    } catch (error) {
      context?.mastra?.getLogger()?.warn('语义检索路失败，已降级纯关键词', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    const results = rrfFuse(vectorHits, keywordResults, 5)

    // 网关线裸 Agent 调用本工具时 context.mastra 不存在，须 optional chaining 不可崩
    context?.mastra?.getLogger()?.info('检索文档', {
      query: terms.join(' '),
      mode: vectorHits.length > 0 ? 'hybrid' : 'keyword',
      hits: results.length,
    })

    return results.length === 0 ? { results, hint: HINT_NO_HIT } : { results }
  },
})
