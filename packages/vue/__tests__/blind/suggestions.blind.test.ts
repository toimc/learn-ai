/**
 * 双盲测试：parseSuggestion / filterSuggestions 纯函数
 * 契约来源：packages/docs/components/prompt-input-suggestion.md 的「suggestions.ts 纯函数」节（未读实现源码）
 */
import { describe, expect, it } from 'vitest'
import { filterSuggestions, parseSuggestion } from '@toimc/vue'
import type { SuggestionItem, SuggestionTrigger } from '@toimc/vue'

const slashItems: SuggestionItem[] = [
  { key: 'table', label: 'table' },
  { key: 'stable', label: 'stable' },
  { key: 'upper', label: 'TABLE' },
]
const slash: SuggestionTrigger = { char: '/', items: slashItems }
const at: SuggestionTrigger = {
  char: '@',
  items: [{ key: 'jo', label: 'John' }],
}

describe('parseSuggestion（契约：prompt-input-suggestion.md）', () => {
  it('触发符位于文本首：query 为触发符后到光标的串，replaceRange 覆盖整个触发词', () => {
    const r = parseSuggestion('/tab', 4, [slash])
    expect(r?.trigger.char).toBe('/')
    expect(r?.query).toBe('tab')
    expect(r?.replaceRange).toEqual([0, 4])
  })

  it('触发符必须位于词首：a/b 的 / 不激活', () => {
    expect(parseSuggestion('a/b', 3, [slash])).toBeNull()
  })

  it('空白之后的触发符激活，replaceRange 从触发符起算', () => {
    const r = parseSuggestion('type /he here', 8, [slash])
    expect(r?.trigger.char).toBe('/')
    expect(r?.query).toBe('he')
    expect(r?.replaceRange).toEqual([5, 8])
  })

  it('行首触发符激活', () => {
    const r = parseSuggestion('\n/foo', 5, [slash])
    expect(r?.query).toBe('foo')
    expect(r?.replaceRange).toEqual([1, 5])
  })

  it('触发词内出现空白即失效', () => {
    expect(parseSuggestion('/he llo', 7, [slash])).toBeNull()
  })

  it('光标停在触发词中间时只取到光标为止', () => {
    const r = parseSuggestion('/hello', 3, [slash])
    expect(r?.query).toBe('he')
    expect(r?.replaceRange).toEqual([0, 3])
  })

  it('多触发符按字符区分', () => {
    const r = parseSuggestion('@jo', 3, [slash, at])
    expect(r?.trigger.char).toBe('@')
    expect(r?.query).toBe('jo')
  })

  it('caret 越界按文本长度收敛；NaN 按 0 处理', () => {
    const r = parseSuggestion('/foo', 100, [slash])
    expect(r?.query).toBe('foo')
    expect(r?.replaceRange).toEqual([0, 4])
    // caret 归零后光标在触发符之前：不激活
    expect(parseSuggestion('/foo', Number.NaN, [slash])).toBeNull()
  })

  it('triggers 为空数组恒返回 null；无触发符文本返回 null', () => {
    expect(parseSuggestion('/foo', 4, [])).toBeNull()
    expect(parseSuggestion('hello', 5, [slash])).toBeNull()
  })
})

describe('filterSuggestions（契约：prompt-input-suggestion.md）', () => {
  it('空 query 展示全部且保持原序', () => {
    expect(filterSuggestions(slashItems, '')).toEqual(slashItems)
  })

  it('前缀 + 包含双策略、大小写不敏感，前缀命中在前、组内保持原序', () => {
    // 'tab' 前缀命中：table(0)、TABLE(2)；包含命中：stable(1)
    const r = filterSuggestions(slashItems, 'tab')
    expect(r.map((i) => i.key)).toEqual(['table', 'upper', 'stable'])
  })

  it('包含命中组内保持原序', () => {
    const items: SuggestionItem[] = [
      { key: 'xay', label: 'xay' },
      { key: 'bab', label: 'bab' },
      { key: 'cab', label: 'cab' },
    ]
    const r = filterSuggestions(items, 'ab')
    expect(r.map((i) => i.key)).toEqual(['bab', 'cab'])
  })

  it('无匹配返回空数组', () => {
    expect(filterSuggestions(slashItems, 'zzz')).toEqual([])
  })
})
