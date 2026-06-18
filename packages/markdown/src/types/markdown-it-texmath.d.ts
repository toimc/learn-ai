// 该文件无顶层 import/export，是 ambient 脚本，其 declare module 对全局生效，
// 为无类型的 markdown-it-texmath 提供类型声明。
declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'

  /**
   * 公式分隔符预设，`dollars`（默认）同时启用：
   *   - 行内：`$...$`
   *   - 块级：`$$...$$`（块级先于行内注册，避免误匹配）
   * 还支持 `'brackets' | 'doxygen' | 'gitlab' | 'julia' | 'kramdown' | 'beg_end'`，
   * 或传数组（如 `['dollars','beg_end']`）合并多套分隔符。
   */
  export type TexmathDelimiter =
    | 'dollars'
    | 'brackets'
    | 'doxygen'
    | 'gitlab'
    | 'julia'
    | 'kramdown'
    | 'beg_end'

  export interface TexmathOptions {
    /** KaTeX 引擎实例（必须传入，否则渲染会输出占位错误文本） */
    engine: unknown
    /** 分隔符预设或预设数组，默认 `'dollars'` */
    delimiters?: TexmathDelimiter | TexmathDelimiter[]
    /**
     * 行内公式是否要求两侧空格（` $x$ `）才被识别，
     * 主要用于避免普通文本中的 `$` 被误判，默认 `false`。
     */
    outerSpace?: boolean
    /** 透传给 KaTeX `renderToString` 的选项（`throwOnError` 等已在内部有默认值） */
    katexOptions?: Record<string, unknown>
  }

  /** markdown-it 数学公式插件：通过 KaTeX 渲染 `$...$` 行内与 `$$...$$` 块级公式 */
  const texmath: ((md: MarkdownIt, options?: TexmathOptions) => void) & {
    katex?: unknown
  }
  export default texmath
}
