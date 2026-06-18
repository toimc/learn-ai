/**
 * 单代码块流式高亮 tokenizer（FR-2.1 ~ FR-2.7）
 *
 * 核心契约（spec FR-2）：
 * - FR-2.1 使用 @shikijs/stream 的 ShikiStreamTokenizer 做逐块增量分词。
 * - FR-2.2 借助 tokenizer 的 grammar state，多行代码跨行连续着色（不每行独立重算）。
 * - FR-2.3 stable / unstable token 拆分：committed 行为 stable，末尾进行中的行为 unstable。
 * - FR-2.4 streaming=true 持续 enqueue（合并 stable+unstable 让尾行可见）；
 *        streaming=false 调 close() 收尾。
 * - FR-2.5 支持的语言集合见 useHighlighter.SUPPORTED_LANGS。
 * - FR-2.6 未知语言 → 转义纯文本，不抛错。
 * - FR-2.7 双主题：themes:{light,dark} + defaultColor:false，
 *        token 仅携带 --shiki-light / --shiki-dark CSS 变量，主题切换靠 CSS 不需重新高亮。
 *
 * 使用前提：传入的 code 已是围栏完整的代码块内容（markdown-it fence 已闭合），
 * 因此本函数对整块做一次 enqueue；若仍处于 streaming，则合并 stable+unstable。
 */
import { ShikiStreamTokenizer } from '@shikijs/stream'
import type { ThemedToken } from 'shiki/core'
import {
  useHighlighter,
  normalizeLang,
  isSupportedLang,
} from './useHighlighter'
import { tokensToHtml, escapeHtml } from '../renderers/tokensToHtml'

/** 未知语言时渲染为转义纯文本（FR-2.6） */
function renderPlainText(code: string): string {
  if (code === '') return ''
  // 纯文本也包 span 保持结构一致，但无 style
  return `<span>${escapeHtml(code)}</span>`
}

/**
 * 流式高亮渲染（FR-2.4 streaming=true 路径）。
 *
 * 创建一个 tokenizer，一次性 enqueue 整块代码，合并 stable + unstable tokens
 * 让进行中的尾行也可见，返回高亮 HTML。
 *
 * @param code 已围栏完整的代码块内容
 * @param rawLang 原始语言标识（别名会被归一）
 */
export async function renderCodeStreaming(
  code: string,
  rawLang: string,
): Promise<string> {
  if (code === '') return ''
  const lang = normalizeLang(rawLang)
  if (!isSupportedLang(lang)) return renderPlainText(code)

  const highlighter = await useHighlighter()
  const tokenizer = new ShikiStreamTokenizer({
    highlighter,
    lang,
    // FR-2.7 双主题 + 不设默认内联 color，完全由 CSS 变量驱动
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

  // FR-2.4：streaming=true 调 enqueue，返回 { stable, unstable }
  const { stable, unstable } = await tokenizer.enqueue(code)
  // FR-2.3：合并 stable + unstable，让尾行可见
  const all: ThemedToken[] = [...stable, ...unstable]
  return tokensToHtml(all)
}

/**
 * 终态高亮渲染（FR-2.4 streaming=false 路径）。
 *
 * enqueue 后调用 close() 收尾，取得最终 stable tokens。
 */
export async function renderCodeFinal(
  code: string,
  rawLang: string,
): Promise<string> {
  if (code === '') return ''
  const lang = normalizeLang(rawLang)
  if (!isSupportedLang(lang)) return renderPlainText(code)

  const highlighter = await useHighlighter()
  const tokenizer = new ShikiStreamTokenizer({
    highlighter,
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

  const { stable: enqueuedStable } = await tokenizer.enqueue(code)
  // FR-2.4：streaming=false 调 close() 收尾，返回最终 stable
  const { stable: closedStable } = tokenizer.close()
  const all: ThemedToken[] = [...enqueuedStable, ...closedStable]
  return tokensToHtml(all)
}
