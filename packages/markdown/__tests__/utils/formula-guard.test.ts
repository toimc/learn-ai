import { describe, expect, it } from 'vitest'
import { guardMathBlocks } from '../../src/utils/formula-guard'

// 畸形样本来源：phd-battle-map/components/ask/renderMd.ts 注释中的实测场景
// 1) LLM 常把 $$..$$ 写成多行块（行首 $$ 单独起、公式体逐行、$$ 单独收）
// 2) 公式体内单独成行的 -- / = 会触发 Setext heading（撕成 <h1>/<h2>）
// 期望值均为手写（依 CommonMark + markdown-it-texmath dollars 规则推演），非实现回放

describe('guardMathBlocks', () => {
  describe('正常内容零扰动', () => {
    it('空字符串原样返回', () => {
      expect(guardMathBlocks('')).toBe('')
    })
    it('纯文本与常规 markdown 不变', () => {
      expect(guardMathBlocks('# 标题\n\n普通 **加粗** 段落')).toBe(
        '# 标题\n\n普通 **加粗** 段落',
      )
    })
    it('单行自闭合块级公式不变', () => {
      expect(guardMathBlocks('$$a^2 + b^2 = c^2$$')).toBe('$$a^2 + b^2 = c^2$$')
    })
    it('行内公式不变', () => {
      expect(guardMathBlocks('公式 $x^2$ 在行内')).toBe('公式 $x^2$ 在行内')
    })
    it('已规范的块级公式（前后空行）不变', () => {
      const md = '结论：\n\n$$\na = b\n$$\n\n后文'
      expect(guardMathBlocks(md)).toBe(md)
    })
    it('块级与行内共存的不变场景', () => {
      const md = '行内 $a$ 文本\n\n$$b^2$$\n'
      expect(guardMathBlocks(md)).toBe(md)
    })
    it('代码 fence 内的 $$ 与 --- 不受保护变换影响', () => {
      const md = '```\n$$\na\n---\n$$\n```'
      expect(guardMathBlocks(md)).toBe(md)
    })
    it('代码 fence 后紧跟规范块级公式不变（fence 后不插空行）', () => {
      const md = '```\ncode\n```\n$$\nx\n$$'
      expect(guardMathBlocks(md)).toBe(md)
    })
    it('引用块内的多行公式不做块隔离（交由行内规则）', () => {
      const md = '> 引用 $$\nx = 1\n$$'
      expect(guardMathBlocks(md)).toBe(md)
    })
    it('列表项内的多行公式不做块隔离（交由行内规则）', () => {
      const md = '- 项 $$\nx = 1\n$$'
      expect(guardMathBlocks(md)).toBe(md)
    })
  })

  describe('多行 $$ 块重聚合（块隔离）', () => {
    it('前文粘住的多行块：插入空行隔离为独立块', () => {
      expect(guardMathBlocks('结论：\n$$\nx = 1\n$$')).toBe(
        '结论：\n\n$$\nx = 1\n$$',
      )
    })
    it('行尾 $$ 起块：前缀文字拆分为独立段落', () => {
      expect(guardMathBlocks('计算结果：$$\nx = 1\n$$')).toBe(
        '计算结果：\n\n$$\nx = 1\n$$',
      )
    })
    it('闭合 $$ 后同行文字拆分为独立段落（防 block 规则静默丢弃）', () => {
      expect(guardMathBlocks('$$\nx = 1\n$$ 后续文字')).toBe(
        '$$\nx = 1\n$$\n\n后续文字',
      )
    })
  })

  describe('Setext 保护（公式体内 --- / === 不再撕裂为标题）', () => {
    it('公式体内的 --- 行：块隔离后由 math_block 整块消费', () => {
      expect(guardMathBlocks('结论如下：\n$$\na = b\n---\n$$')).toBe(
        '结论如下：\n\n$$\na = b\n---\n$$',
      )
    })
    it('公式体内的 === 行同样保护（h1 变体）', () => {
      expect(guardMathBlocks('文字\n$$\na\n===\n$$')).toBe(
        '文字\n\n$$\na\n===\n$$',
      )
    })
    it('公式体内的有序列表行不再打断段落', () => {
      expect(guardMathBlocks('文字\n$$\na\n1. 列表\n$$')).toBe(
        '文字\n\n$$\na\n1. 列表\n$$',
      )
    })
  })

  describe('未闭合 $$ 容错（段落末补齐，不吞后续正文）', () => {
    it('未闭合块在段落末补齐闭合符，空行后的正文保留', () => {
      expect(guardMathBlocks('$$\nx = 1\n\n正文段落')).toBe(
        '$$\nx = 1\n$$\n\n正文段落',
      )
    })
    it('未闭合块延伸到文档末尾：末尾补齐', () => {
      expect(guardMathBlocks('$$\nx = 1')).toBe('$$\nx = 1\n$$')
    })
    it('行尾 $$ 起块且未闭合：前缀拆分 + 段落末补齐', () => {
      expect(guardMathBlocks('结果：$$\nx = 1\n\n正文')).toBe(
        '结果：\n\n$$\nx = 1\n$$\n\n正文',
      )
    })
    it('孤立的 $$ 后跟空行：不做公式处理（保留字面量）', () => {
      expect(guardMathBlocks('$$\n\n正文')).toBe('$$\n\n正文')
    })
  })

  describe('货币 $ 排除（数字紧邻 + 货币上下文启发式）', () => {
    it('CJK 标点边界的金额被转义为字面量', () => {
      expect(guardMathBlocks('费用 $100，补贴$五十元，运费$30元')).toBe(
        '费用 \\$100，补贴$五十元，运费\\$30元',
      )
    })
    it('行尾金额被转义', () => {
      expect(guardMathBlocks('总价 $200')).toBe('总价 \\$200')
    })
    it('千分位金额被转义', () => {
      expect(guardMathBlocks('价格 $1,299。')).toBe('价格 \\$1,299。')
    })
    it('空格 + CJK 边界的金额被转义', () => {
      expect(guardMathBlocks('花费 $50 元')).toBe('花费 \\$50 元')
    })
    it('数字后跟运算符/字母的不是货币：数学表达式不变', () => {
      expect(guardMathBlocks('值域 $2^3$ 与 $5x + 1$')).toBe(
        '值域 $2^3$ 与 $5x + 1$',
      )
    })
    it('代码 fence 内的 $ 不转义', () => {
      const md = '```sh\necho $5\n```'
      expect(guardMathBlocks(md)).toBe(md)
    })
  })

  describe('幂等性：guard(guard(x)) === guard(x)', () => {
    const samples: Array<[string, string]> = [
      ['结论如下：\n$$\na = b\n---\n$$', 'Setext ---'],
      ['文字\n$$\na\n===\n$$', 'Setext ==='],
      ['文字\n$$\na\n1. 列表\n$$', '列表打断'],
      ['结论：\n$$\nx = 1\n$$', '前文粘住'],
      ['计算结果：$$\nx = 1\n$$', '行尾起块'],
      ['$$\nx = 1\n$$ 后续文字', '闭合后同行文字'],
      ['$$\nx = 1\n\n正文段落', '未闭合段落末补齐'],
      ['$$\nx = 1', '未闭合到 EOF'],
      ['费用 $100，补贴$五十元，运费$30元', '货币转义'],
      ['结论：\n\n$$\na = b\n$$\n\n后文', '已规范块'],
    ]
    it.each(samples)('幂等：%s', (input) => {
      const once = guardMathBlocks(input)
      expect(guardMathBlocks(once)).toBe(once)
    })
  })
})
