import { describe, expect, it } from 'vitest'
import { splitHighlightedLines } from '../../src/utils/split-lines'

// 期望值全部手写字面量（独立于实现推导），算法偏离时必须红。
// 样本取自 Shiki tokensToHtml 的真实输出形态：token 级 span 串接，
// 跨行 token（块注释/模板字符串）的 span 内含换行。

describe('splitHighlightedLines', () => {
  it('跨行 span：行尾闭合、下一行以相同开标签重开', () => {
    // 块注释 token 跨两行：一个 span 内含 \n
    const html = '<span style="--shiki-light:#1a1">/* line1\nline2 */</span>'
    expect(splitHighlightedLines(html)).toEqual([
      '<span style="--shiki-light:#1a1">/* line1</span>',
      '<span style="--shiki-light:#1a1">line2 */</span>',
    ])
  })

  it('嵌套 span 跨行：重开时保持嵌套顺序，闭合也按嵌套顺序', () => {
    const html = '<span class="a"><span class="b">x\ny</span>z</span>'
    expect(splitHighlightedLines(html)).toEqual([
      '<span class="a"><span class="b">x</span></span>',
      '<span class="a"><span class="b">y</span>z</span>',
    ])
  })

  it('跨行 span 中间的空行：空行也被 prefix 包裹并闭合，行数不丢', () => {
    const html = '<span class="a">x\n\ny</span>'
    expect(splitHighlightedLines(html)).toEqual([
      '<span class="a">x</span>',
      '<span class="a"></span>',
      '<span class="a">y</span>',
    ])
  })

  it('无 span 纯文本：按行原样返回（含已转义字符）', () => {
    const html = 'plain1\nplain2 &lt; 3'
    expect(splitHighlightedLines(html)).toEqual(['plain1', 'plain2 &lt; 3'])
  })

  it('行内平衡的 span（Shiki 常规形态）：不加 prefix 也不补闭合', () => {
    const html =
      '<span style="s1">const</span> <span style="s2">a</span>\n<span style="s3">b</span>'
    expect(splitHighlightedLines(html)).toEqual([
      '<span style="s1">const</span> <span style="s2">a</span>',
      '<span style="s3">b</span>',
    ])
  })

  it('同一行先闭合上一行遗留 span、再开新跨行 span：两条互不干扰', () => {
    const html = '<span class="a">p\nq</span><span class="b">r\ns</span>'
    expect(splitHighlightedLines(html)).toEqual([
      '<span class="a">p</span>',
      '<span class="a">q</span><span class="b">r</span>',
      '<span class="b">s</span>',
    ])
  })

  it('边界：空串返回单元素空行数组（与 String.split 语义一致）', () => {
    expect(splitHighlightedLines('')).toEqual([''])
  })
})
