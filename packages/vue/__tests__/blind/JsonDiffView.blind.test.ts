/**
 * 双盲测试：JsonDiffView
 * 契约来源：packages/docs/components/json-diff-view.md（未读实现源码）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JsonDiffView, setAiChatLocale } from '@toimc/vue'
import { norm } from './helpers'

const mounted: VueWrapper[] = []

interface DiffProps {
  oldValue: unknown
  newValue: unknown
  oldLabel?: string
  newLabel?: string
  onlyChanged?: boolean
}

function mountDiff(props: DiffProps) {
  const w = mount(JsonDiffView, { props, attachTo: document.body })
  mounted.push(w)
  return w
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('JsonDiffView（契约：docs/components/json-diff-view.md）', () => {
  it('表头默认可被 oldLabel/newLabel 覆盖', () => {
    const w = mountDiff({
      oldValue: { a: 1 },
      newValue: { a: 2 },
      oldLabel: 'OLD SIDE',
      newLabel: 'NEW SIDE',
    })
    const text = w.text()
    expect(text).toContain('OLD SIDE')
    expect(text).toContain('NEW SIDE')
  })

  it('嵌套对象按 a.b.c 路径展平对齐，修改行旧值新值都展示', () => {
    const w = mountDiff({
      oldValue: { a: { b: { c: 'oldval' } } },
      newValue: { a: { b: { c: 'newval' } } },
    })
    const text = w.text()
    expect(text).toContain('a.b.c')
    expect(text).toContain('oldval')
    expect(text).toContain('newval')
  })

  it('onlyChanged 过滤相同路径，差异路径保留', () => {
    const w = mountDiff({
      oldValue: { keep: 'sameval', gone: 'oldend' },
      newValue: { keep: 'sameval', fresh: 'newval' },
      onlyChanged: true,
    })
    const text = w.text()
    expect(text).toContain('gone')
    expect(text).toContain('oldend')
    expect(text).toContain('fresh')
    expect(text).toContain('newval')
    expect(text).not.toContain('keep')
    expect(text).not.toContain('sameval')
  })

  it('全同 + onlyChanged 显示空态文案（zh：内容相同）', () => {
    setAiChatLocale('zh-CN')
    const w = mountDiff({
      oldValue: { a: 1 },
      newValue: { a: 1 },
      onlyChanged: true,
    })
    expect(w.text()).toContain('内容相同')
  })

  it('非对象输入按单值行处理；null / undefined 字面量渲染', () => {
    const w = mountDiff({ oldValue: null, newValue: 'zzz' })
    const text = w.text()
    expect(text).toContain('null')
    expect(text).toContain('zzz')

    const u = mountDiff({ oldValue: { a: undefined }, newValue: { a: 1 } })
    expect(u.text()).toContain('undefined')
  })

  it('数组整体序列化不逐项展开', () => {
    const w = mountDiff({ oldValue: [1, 2], newValue: [1, 3] })
    const flat = norm(w.text()).replace(/\s+/g, '')
    expect(flat).toContain('[1,2]')
    expect(flat).toContain('[1,3]')
  })

  it('循环引用渲染 [Circular]；兄弟节点重复引用同一对象不误报', () => {
    const shared: Record<string, unknown> = { v: 'shared-one' }
    const sibling = mountDiff({
      oldValue: { a: shared, b: shared },
      newValue: { a: { v: 'x1' }, b: { v: 'x2' } },
    })
    expect(sibling.text()).not.toContain('[Circular]')

    const cyc: Record<string, unknown> = {}
    cyc.self = cyc
    const circular = mountDiff({
      oldValue: { c: cyc },
      newValue: { c: 'plain' },
    })
    expect(circular.text()).toContain('[Circular]')
  })

  it('BigInt 等无法 JSON 序列化值降级 String()', () => {
    const w = mountDiff({
      oldValue: { n: 123456789n },
      newValue: { n: 987654321n },
    })
    const text = w.text()
    expect(text).toContain('123456789')
    expect(text).toContain('987654321')
  })
})
