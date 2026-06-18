import { describe, expect, it } from 'vitest'
import { useMarkdownIt } from './useMarkdownIt'

describe('useMarkdownIt', () => {
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
})
