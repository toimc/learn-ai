import { describe, expect, it } from 'vitest'
import { renderCodeStreaming, renderCodeFinal } from './useShikiTokenizer'

/** 从 HTML 中提取纯文本（去标签、反转义），用于断言源码可见性 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

describe('renderCodeStreaming', () => {
  it('空代码返回空字符串', async () => {
    const html = await renderCodeStreaming('', 'javascript', true)
    expect(html).toBe('')
  })

  it('未知语言降级为转义纯文本（FR-2.6，不抛错）', async () => {
    const html = await renderCodeStreaming('const a = <b>', 'brainfuck', true)
    // 应转义 < >，且不含高亮 span 的 style（纯文本）
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('style="')
  })

  it('已知语言产出含源码文本的高亮 span', async () => {
    const html = await renderCodeStreaming('const a = 1', 'javascript', true)
    // 至少包含源码字符
    expect(html).toContain('const')
    expect(html).toContain('<span')
    // 双主题应输出 CSS 变量（defaultColor:false）
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
  })

  it('别名归一（js → javascript）正常高亮', async () => {
    const html = await renderCodeStreaming('const a = 1', 'js', true)
    expect(html).toContain('const')
    expect(html).toContain('--shiki-light')
  })

  it('多行代码 grammar-state 连续不报错（FR-2.2）', async () => {
    const code = 'function add(a, b) {\n  return a + b\n}\n'
    const html = await renderCodeStreaming(code, 'typescript', true)
    // 包含全部源码字符（跨行）
    expect(html).toContain('function')
    expect(html).toContain('return')
    // 换行保留
    expect(html).toContain('\n')
  })

  it('streaming=true 合并 stable+unstable（尾行可见，FR-2.3/2.4）', async () => {
    // 末尾不带换行的代码：最后一行属于 unstable，streaming 时应仍渲染
    const html = await renderCodeStreaming(
      'const x = 1\nconst y = 2',
      'javascript',
    )
    // 末行跨多个 span，提取纯文本断言
    expect(textOf(html)).toContain('const y = 2')
  })
})

describe('renderCodeFinal', () => {
  it('streaming=false 调用 close 收尾（FR-2.4）', async () => {
    const html = await renderCodeFinal('const a = 1', 'javascript')
    expect(html).toContain('const')
    expect(html).toContain('--shiki-light')
  })

  it('空代码返回空字符串', async () => {
    const html = await renderCodeFinal('', 'javascript')
    expect(html).toBe('')
  })

  it('未知语言降级纯文本', async () => {
    const html = await renderCodeFinal('x < y', 'totally-unknown-lang')
    expect(html).toContain('&lt;')
    expect(html).not.toContain('style="')
  })

  it('多行 close 路径包含全部行', async () => {
    const code = 'const a = 1\nconst b = 2\nconst c = 3'
    const html = await renderCodeFinal(code, 'javascript')
    const text = textOf(html)
    expect(text).toContain('const a = 1')
    expect(text).toContain('const b = 2')
    expect(text).toContain('const c = 3')
  })
})
