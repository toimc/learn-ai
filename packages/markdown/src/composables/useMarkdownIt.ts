import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
// FR-4（spec 04）：KaTeX 样式不再模块级隐式注入（避免全局 @font-face 污染宿主）。
// 需要公式渲染样式的宿主按需引入：import '@ai-chat/markdown/katex.css'

// markdown-it 15 默认导出为 callable 包装(值)，实例类型需用 InstanceType 推导
let instance: InstanceType<typeof MarkdownIt> | null = null

export function useMarkdownIt(): InstanceType<typeof MarkdownIt> {
  if (instance) return instance
  instance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: true,
  })
    .use(taskLists, { enabled: true, label: true })
    // FR-3.2：texmath `dollars` 预设同时注册块级 `math_block`（`$$…$$`）与行内 `math_inline`（`$…$`）规则。
    // 二者是各自独立的规则，块级优先级确保 `$$` 不被行内 `$` 规则抢先吞掉。
    // KaTeX 引擎由我们显式注入，texmath 内部默认 throwOnError:false，语法错误不会中断渲染。
    .use(texmath, {
      engine: katex,
      delimiters: 'dollars',
    })

  // FR-4.1：覆盖 fence —— mermaid 块输出占位 div（Phase 5 由 MarkdownRenderer 替换为 <MermaidBlock>），普通块走默认渲染
  const defaultFence = instance.renderer.rules.fence!.bind(
    instance.renderer.rules,
  )
  instance.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim() === 'mermaid') {
      // encode 防止源码中的引号/尖括号注入 data-mermaid 属性
      const encoded = encodeURIComponent(token.content)
      return `<div class="ai-chat-mermaid-placeholder" data-mermaid="${encoded}"></div>`
    }
    return defaultFence(tokens, idx, options, env, self)
  }

  return instance
}

export function __resetMarkdownIt(): void {
  instance = null
}
