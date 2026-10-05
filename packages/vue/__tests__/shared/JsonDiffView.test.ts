import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import JsonDiffView from '../../src/shared/JsonDiffView.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function cells(w: ReturnType<typeof mount>) {
  return w.findAll('.ai-chat-jsondiff__cell')
}

describe('JsonDiffView 表头与文案', () => {
  it('默认表头走 i18n：修改前 / 修改后', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: { a: 1 }, newValue: { a: 2 } },
    })
    const labels = w.findAll('.ai-chat-jsondiff__label')
    expect(labels.map((l) => l.text())).toEqual(['修改前', '修改后'])
  })

  it('oldLabel/newLabel props 覆盖 i18n 默认值', () => {
    const w = mount(JsonDiffView, {
      props: {
        oldValue: { a: 1 },
        newValue: { a: 2 },
        oldLabel: 'Draft',
        newLabel: 'Final',
      },
    })
    const labels = w.findAll('.ai-chat-jsondiff__label')
    expect(labels.map((l) => l.text())).toEqual(['Draft', 'Final'])
  })

  it('onlyChanged 过滤后无差异行时显示 i18n 空态文案', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: { a: 1 }, newValue: { a: 1 }, onlyChanged: true },
    })
    expect(w.get('.ai-chat-jsondiff__empty').text()).toBe('内容相同')
    expect(cells(w).length).toBe(0)
  })
})

describe('JsonDiffView 行对齐与状态', () => {
  it('非对象输入按单值行：标量修改为一行 modified', () => {
    const w = mount(JsonDiffView, { props: { oldValue: 1, newValue: 2 } })
    const list = cells(w)
    // 单行两列
    expect(list.length).toBe(2)
    expect(list[0].classes()).toContain('is-del')
    expect(list[1].classes()).toContain('is-add')
    expect(list[0].text()).toContain('−')
    expect(list[1].text()).toContain('+')
  })

  it('嵌套对象按路径对齐：same 行双列同值、removed 左红右空、added 左空右绿', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: { a: 1, b: 2 }, newValue: { a: 1, c: 3 } },
    })
    const list = cells(w)
    // 三行（a same / b removed / c added）× 两列
    expect(list.length).toBe(6)
    // b removed：左列 is-del 有值，右列 is-void
    expect(list[2].classes()).toContain('is-del')
    expect(list[2].text()).toContain('b:')
    expect(list[2].text()).toContain('2')
    expect(list[3].classes()).toContain('is-void')
    // c added：左列 is-void，右列 is-add
    expect(list[4].classes()).toContain('is-void')
    expect(list[5].classes()).toContain('is-add')
    expect(list[5].text()).toContain('c:')
    expect(list[5].text()).toContain('3')
  })

  it('深嵌套路径展开为 a.b.c', () => {
    const w = mount(JsonDiffView, {
      props: {
        oldValue: { a: { b: { c: 1 } } },
        newValue: { a: { b: { c: 2 } } },
      },
    })
    expect(w.text()).toContain('a.b.c:')
  })

  it('onlyChanged 默认 false 显示 same 行；true 时过滤 same', () => {
    const all = mount(JsonDiffView, {
      props: { oldValue: { a: 1, b: 2 }, newValue: { a: 1, b: 3 } },
    })
    expect(cells(all).length).toBe(4)

    const changed = mount(JsonDiffView, {
      props: {
        oldValue: { a: 1, b: 2 },
        newValue: { a: 1, b: 3 },
        onlyChanged: true,
      },
    })
    expect(cells(changed).length).toBe(2)
    expect(changed.text()).not.toContain('a:')
  })
})

describe('JsonDiffView 字符级高亮（零 v-html）', () => {
  it('公共前后缀切分：hello→helpo 渲染 hel/l/p/o 分段 span', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: 'hello', newValue: 'helpo' },
    })
    const oldChar = w.get('.ai-chat-jsondiff__char--old')
    const newChar = w.get('.ai-chat-jsondiff__char--new')
    expect(oldChar.text()).toBe('l')
    expect(newChar.text()).toBe('p')
    // 旧值格完整内容 = 前缀 + midOld + 后缀
    expect(w.findAll('.ai-chat-jsondiff__cell')[0].text()).toContain('hello')
    expect(w.findAll('.ai-chat-jsondiff__cell')[1].text()).toContain('helpo')
  })

  it('完全同值行不做字符级切分（无 char span）', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: { a: 'x' }, newValue: { a: 'x' } },
    })
    expect(w.find('.ai-chat-jsondiff__char--old').exists()).toBe(false)
  })
})

describe('JsonDiffView 序列化边界与循环引用', () => {
  it('null / undefined / 空对象序列化为单行', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: null, newValue: undefined },
    })
    expect(w.text()).toContain('null')
    expect(w.text()).toContain('undefined')
  })

  it('数组整体序列化为单行（不逐项展开）', () => {
    const w = mount(JsonDiffView, {
      props: { oldValue: [1, 2], newValue: [1, 3] },
    })
    expect(w.text()).toContain('[1,2]')
    expect(w.text()).toContain('[1,3]')
  })

  it('BigInt 无法 JSON 序列化时降级 String()：10n → "10"', () => {
    const w = mount(JsonDiffView, { props: { oldValue: 10n, newValue: 20n } })
    expect(w.text()).toContain('10')
    expect(w.text()).toContain('20')
  })

  it('循环引用守卫：self 引用渲染 [Circular] 标记而非无限递归', () => {
    const oldObj: Record<string, unknown> = { name: 'a' }
    oldObj.self = oldObj
    const w = mount(JsonDiffView, {
      props: { oldValue: oldObj, newValue: { name: 'b' } },
    })
    expect(w.text()).toContain('[Circular]')
  })

  it('兄弟节点重复引用同一对象不误报循环（栈式 WeakSet）', () => {
    const shared = { v: 1 }
    const w = mount(JsonDiffView, {
      props: {
        oldValue: { a: shared, b: shared },
        newValue: { a: shared, b: shared },
      },
    })
    expect(w.text()).not.toContain('[Circular]')
    expect(w.text()).toContain('a.v:')
    expect(w.text()).toContain('b.v:')
  })
})
