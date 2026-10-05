import { describe, expect, it } from 'vitest'
import {
  filterSuggestions,
  parseSuggestion,
  type SuggestionItem,
  type SuggestionTrigger,
} from '../../src/prompt-input/suggestions'

const slashItems: SuggestionItem[] = [
  { key: 'h1', label: '标题', description: '大标题' },
  { key: 'bold', label: '加粗' },
]
const atItems: SuggestionItem[] = [{ key: 'jo', label: 'John' }]

const triggers: SuggestionTrigger[] = [
  { char: '/', items: slashItems },
  { char: '@', items: atItems },
]

describe('parseSuggestion 光标触发词解析', () => {
  it('正常：光标紧跟触发符，query 为空串', () => {
    const r = parseSuggestion('/', 1, triggers)
    expect(r).not.toBeNull()
    expect(r!.trigger.char).toBe('/')
    expect(r!.query).toBe('')
    expect(r!.replaceRange).toEqual([0, 1])
  })

  it('正常：/head 光标在词尾，query=head，区间覆盖触发符', () => {
    const r = parseSuggestion('/head', 5, triggers)
    // 返回 trigger 必须是传入数组的同一引用（宿主靠它取 items）
    expect(r!.trigger).toBe(triggers[0])
    expect(r!.query).toBe('head')
    expect(r!.replaceRange).toEqual([0, 5])
  })

  it('正常：光标在触发词中间，只取触发符到光标的串', () => {
    // '/he|ad'：光标 3，query 只到光标，替换后 'ad' 保留
    const r = parseSuggestion('/head', 3, triggers)
    expect(r!.query).toBe('he')
    expect(r!.replaceRange).toEqual([0, 3])
  })

  it('正常：@ 触发命中对应 trigger', () => {
    const r = parseSuggestion('hello @jo', 9, triggers)
    expect(r!.trigger.char).toBe('@')
    expect(r!.query).toBe('jo')
    expect(r!.replaceRange).toEqual([6, 9])
  })

  it('正常：换行后触发符激活（空白边界含换行）', () => {
    const r = parseSuggestion('hi\n/x', 5, triggers)
    expect(r!.query).toBe('x')
    expect(r!.replaceRange).toEqual([3, 5])
  })

  it('正常：中文触发词 query 原样返回', () => {
    const r = parseSuggestion('/标题', 3, triggers)
    expect(r!.query).toBe('标题')
  })

  it('边界：普通文本无触发符返回 null', () => {
    expect(parseSuggestion('hello world', 11, triggers)).toBeNull()
  })

  it('边界：词中触发符不激活（a/b）', () => {
    expect(parseSuggestion('a/b', 3, triggers)).toBeNull()
  })

  it('边界：触发符后有空格即失效（/ he）', () => {
    // 光标前紧邻空白：向左扫先撞空白
    expect(parseSuggestion('/ he', 4, triggers)).toBeNull()
  })

  it('边界：光标停在空白上返回 null', () => {
    expect(parseSuggestion('foo ', 4, triggers)).toBeNull()
  })

  it('边界：光标 0 返回 null', () => {
    expect(parseSuggestion('/head', 0, triggers)).toBeNull()
  })

  it('边界：caret 越界按文本长度收敛', () => {
    const r = parseSuggestion('/head', 99, triggers)
    expect(r!.query).toBe('head')
    expect(r!.replaceRange).toEqual([0, 5])
  })

  it('异常：triggers 为空数组返回 null', () => {
    expect(parseSuggestion('/head', 5, [])).toBeNull()
  })

  it('异常：caret 为 NaN 按处理为 0 返回 null', () => {
    expect(parseSuggestion('/head', Number.NaN, triggers)).toBeNull()
  })
})

describe('filterSuggestions label 前缀 + 包含双策略过滤', () => {
  const items: SuggestionItem[] = [
    { key: 'chat-header', label: 'chat-header' },
    { key: 'header', label: 'header' },
    { key: 'heat', label: 'heat' },
    { key: 'image', label: 'image' },
  ]

  it('正常：空 query 原样返回全部', () => {
    expect(filterSuggestions(items, '')).toEqual(items)
  })

  it('正常：前缀命中在前、包含命中在后，各组保持原序', () => {
    expect(filterSuggestions(items, 'he')).toEqual([
      { key: 'header', label: 'header' },
      { key: 'heat', label: 'heat' },
      { key: 'chat-header', label: 'chat-header' },
    ])
  })

  it('正常：大小写不敏感', () => {
    expect(filterSuggestions(items, 'HE')).toHaveLength(3)
    expect(filterSuggestions([{ key: 'k', label: 'Header' }], 'hea')).toEqual([
      { key: 'k', label: 'Header' },
    ])
  })

  it('正常：无匹配返回空数组', () => {
    expect(filterSuggestions(items, 'zzz')).toEqual([])
  })

  it('正常：前缀命中不重复进包含组', () => {
    const only = [{ key: 'a', label: 'head' }]
    expect(filterSuggestions(only, 'head')).toEqual([
      { key: 'a', label: 'head' },
    ])
  })

  it('正常：children 原样透传不参与过滤', () => {
    const withChildren: SuggestionItem[] = [
      { key: 'p', label: 'parent', children: [{ key: 'c', label: 'child' }] },
    ]
    const r = filterSuggestions(withChildren, 'par')
    expect(r).toHaveLength(1)
    expect(r[0].children).toEqual([{ key: 'c', label: 'child' }])
  })
})
