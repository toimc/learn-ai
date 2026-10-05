import { describe, it, expect } from 'vitest'
import { splitAtoms, joinAtoms } from '../../src/utils/md-atom'

// 红线不变式：joinAtoms(splitAtoms(md)) === md（字节级往返保真）
// 样本含 CRLF / 段间空白 / 未闭合 fence / 未闭合标签 / 空串等边界

describe('splitAtoms 往返保真', () => {
  const samples: Array<[string, string]> = [
    ['纯文本段落', '# 标题\n\n第一段\n\n第二段\n'],
    ['无尾换行', '# 标题\n\n正文'],
    ['CRLF 全文', '# T\r\n\r\n正文 $x$\r\n'],
    ['CRLF + fence', '```js\r\nconst a = 1\r\n```\r\ntail\r\n'],
    ['frontmatter + 正文', '---\ntitle: t\n---\n\n# H\n'],
    ['多行公式块', '前言\n$$\nE = mc^2\n$$\n后语'],
    ['单行公式块', 'a\n\n$$x^2$$\n\nb\n'],
    ['未闭合 fence', 'para\n\n```js\nconst a = 1\nconst b = 2\n'],
    ['fence 内含 $$ 与 <div 不误吞', '```md\n$$\n<div>x</div>\n```\nafter\n'],
    [
      'details 配对块',
      '<details>\n<summary>点开</summary>\n内容\n</details>\n后文\n',
    ],
    ['多行注释', '<!--\n多行\n注释 -->\n正文\n'],
    ['段间空白字节保留', 'a\n \n  \nb'],
    ['原子与正文无空行相邻', '**公式**：\n$$x$$\n后续'],
    ['未闭合 details 退化为单行', '<details>\n内容没闭合'],
    ['波浪线 fence', '~~~\ncode\n~~~\ntail'],
    ['仅换行符', '\n'],
    ['void 标签连排', '<img src="a.png">\n<span>锚点</span>\n\n正文\n'],
  ]

  for (const [name, md] of samples) {
    it(`${name}：join(split(md)) === md`, () => {
      expect(joinAtoms(splitAtoms(md))).toBe(md)
    })
  }

  it('空串切分为空数组，join 回空串', () => {
    expect(splitAtoms('')).toEqual([])
    expect(joinAtoms(splitAtoms(''))).toBe('')
  })
})

describe('splitAtoms 结构切分', () => {
  it('frontmatter 整块直通，正文为 text', () => {
    const atoms = splitAtoms('---\ntitle: t\n---\n\nbody\n')
    expect(atoms).toHaveLength(2)
    expect(atoms[0]).toEqual({
      type: 'frontmatter',
      raw: '---\ntitle: t\n---\n',
      editable: false,
    })
    expect(atoms[1]).toEqual({ type: 'text', raw: '\nbody\n', editable: true })
  })

  it('fence 块独立成 atom，收尾换行归入块内', () => {
    const atoms = splitAtoms('```js\nconst a=1\n```\nafter\n')
    expect(atoms).toHaveLength(2)
    expect(atoms[0]).toEqual({
      type: 'fence',
      raw: '```js\nconst a=1\n```\n',
      editable: false,
    })
    expect(atoms[1]).toEqual({ type: 'text', raw: 'after\n', editable: true })
  })

  it('fence 内的 $$ 与 <div 行不识别为原子（防误吞）', () => {
    const atoms = splitAtoms('```md\n$$\n<div>x</div>\n```\nafter\n')
    expect(atoms.map((a) => a.type)).toEqual(['fence', 'text'])
  })

  it('多行公式块到闭合 $$ 行止', () => {
    const atoms = splitAtoms('a\n$$\nx\n$$\nb')
    expect(atoms.map((a) => a.type)).toEqual(['text', 'math-block', 'text'])
    expect(atoms[1]).toEqual({
      type: 'math-block',
      raw: '$$\nx\n$$\n',
      editable: false,
    })
    expect(atoms[2]).toEqual({ type: 'text', raw: 'b', editable: true })
  })

  it('未闭合 fence 兜底吞到文末，往返不丢字节', () => {
    const atoms = splitAtoms('para\n\n```js\nconst a = 1\nconst b = 2\n')
    expect(atoms.map((a) => a.type)).toEqual(['text', 'fence'])
    expect(atoms[1].raw).toBe('```js\nconst a = 1\nconst b = 2\n')
  })

  it('details 配对标签扫到闭合行止', () => {
    const atoms = splitAtoms(
      '<details>\n<summary>点开</summary>\n内容\n</details>\n后文\n',
    )
    expect(atoms.map((a) => a.type)).toEqual(['html-block', 'text'])
    expect(atoms[0].raw).toBe(
      '<details>\n<summary>点开</summary>\n内容\n</details>\n',
    )
  })

  it('四种结构块混排的类型序列与可编辑位', () => {
    const md =
      '---\nk: v\n---\n\n# H\n\n$$\nx\n$$\n\n```js\ncode\n```\n\n<div>\ny\n</div>\n\ntail\n'
    const atoms = splitAtoms(md)
    expect(atoms.map((a) => a.type)).toEqual([
      'frontmatter',
      'text',
      'math-block',
      'text',
      'fence',
      'text',
      'html-block',
      'text',
    ])
    // 只有 text 可逐字编辑，结构块一律整块直通
    for (const atom of atoms) {
      expect(atom.editable).toBe(atom.type === 'text')
    }
    expect(joinAtoms(atoms)).toBe(md)
  })
})

describe('joinAtoms', () => {
  it('空数组返回空串', () => {
    expect(joinAtoms([])).toBe('')
  })

  it('按 raw 原样拼接不做任何改写', () => {
    expect(
      joinAtoms([
        { type: 'text', raw: 'abc', editable: true },
        { type: 'fence', raw: '```\nx\n```', editable: false },
      ]),
    ).toBe('abc```\nx\n```')
  })
})
