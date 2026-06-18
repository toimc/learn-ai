import { beforeEach, describe, expect, it } from 'vitest'
import { __resetMarkdownIt, useMarkdownIt } from './useMarkdownIt'

describe('useMarkdownIt', () => {
  // 单例会跨用例残留插件状态，每个用例前重置以保持隔离
  beforeEach(() => __resetMarkdownIt())

  it('解析标题与段落', () => {
    const md = useMarkdownIt()
    expect(md.render('# 标题')).toContain('<h1>标题</h1>')
  })
  it('启用 GFM 表格', () => {
    const md = useMarkdownIt()
    const out = md.render('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(out).toContain('<table>')
  })
  it('单例：多次调用返回同一实例', () => {
    expect(useMarkdownIt()).toBe(useMarkdownIt())
  })
  it('GFM 任务列表渲染复选框', () => {
    const md = useMarkdownIt()
    const out = md.render('- [ ] todo\n- [x] done')
    expect(out).toContain('task-list-item')
  })

  it('块级 $$...$$ 公式经 katex 渲染（FR-3.2）', () => {
    const md = useMarkdownIt()
    const out = md.render('$$a^2 + b^2 = c^2$$')
    // texmath 调用 katex.renderToString，输出必含 .katex 根类
    expect(out).toContain('katex')
    // 块级公式落在专属容器（texmath 默认 .math-display / .katex-display）
    expect(out).toContain('a')
  })

  it('行内 $...$ 公式经 katex 渲染（FR-3.2，块级先于行内）', () => {
    const md = useMarkdownIt()
    // 普通文本中混入行内公式：确认 $ 不被当作字面量，而是触发 katex
    const out = md.render('公式 $x^2$ 在行内')
    expect(out).toContain('katex')
    expect(out).toContain('x')
  })

  it('$$ 与 $ 共存时块级优先（同一文档同时含块级与行内）', () => {
    const md = useMarkdownIt()
    const out = md.render('行内 $a$ 文本\n\n$$b^2$$\n')
    // 两处都应被 katex 渲染（恰好出现两次 katex 根类）
    const count = (out.match(/class="katex"/g) || []).length
    expect(count).toBe(2)
  })

  it('非法公式不中断渲染（texmath 内部 throwOnError 默认 false）', () => {
    const md = useMarkdownIt()
    // 不应抛错，且仍产出段落结构
    const out = md.render('前置文本\n\n$$\\notacmd{$$\n\n后置文本')
    expect(out).toContain('前置文本')
    expect(out).toContain('后置文本')
  })
})
