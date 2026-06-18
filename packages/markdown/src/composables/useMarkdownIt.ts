import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'
import katex from 'katex'
// FR-3.4：KaTeX 样式按需随包引入，组件使用方无需手动添加 <link>
import 'katex/dist/katex.min.css'

let instance: MarkdownIt | null = null

export function useMarkdownIt(): MarkdownIt {
  if (instance) return instance
  instance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: true,
  })
    .use(taskLists, { enabled: true, label: true })
    // FR-3.2：texmath `dollars` 预设同时注册块级 `$$...$$` 与行内 `$...$` 规则，
    // 块级规则在 markdown-it 的 `fence` 之前注入，天然保证「块级先于行内」的匹配顺序。
    // KaTeX 引擎由我们显式注入，texmath 内部默认 throwOnError:false，语法错误不会中断渲染。
    .use(texmath, {
      engine: katex,
      delimiters: 'dollars',
    })
  return instance
}

export function __resetMarkdownIt(): void {
  instance = null
}
