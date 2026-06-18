// 该文件无顶层 import/export，是 ambient 脚本，其 declare module 对全局生效，
// 为无类型的 markdown-it-task-lists 提供类型声明。
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  export interface TaskListsOptions {
    /** 是否启用任务列表语法（默认 true） */
    enabled?: boolean
    /** 渲染可访问的 <label> 包裹 checkbox（默认 false） */
    label?: boolean
    /** 将 checkbox 放在列表项文本之后（默认 false） */
    labelAfter?: boolean
  }

  /** markdown-it 任务列表插件：`- [ ]` / `- [x]` 渲染为带 checkbox 的列表项 */
  const taskLists: (md: MarkdownIt, options?: TaskListsOptions) => void
  export default taskLists
}
