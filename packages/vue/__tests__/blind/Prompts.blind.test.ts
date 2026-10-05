/**
 * 双盲测试：Prompts
 * 契约来源：packages/docs/components/prompts.md（未读实现源码）
 * 文档写明默认文案：en prompts.title = 'Try asking'
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Prompts, setAiChatLocale } from '@toimc/vue'
import type { PromptItem } from '@toimc/vue'

const mounted: VueWrapper[] = []

const items: PromptItem[] = [
  {
    key: 'weekly',
    label: 'Weekly report',
    description: 'Summarize the week',
    icon: '📝',
  },
  {
    key: 'code',
    label: 'Explain code',
    description: 'Line by line',
    icon: '💡',
  },
  {
    key: 'idea',
    label: 'Brainstorm',
    description: 'Multiple directions',
    icon: '🚀',
  },
]

interface PromptsProps {
  items: PromptItem[]
  title?: string
  vertical?: boolean
  wrap?: boolean
}

function mountPrompts(props: PromptsProps, slots: Record<string, string> = {}) {
  const w = mount(Prompts, { props, slots, attachTo: document.body })
  mounted.push(w)
  return w
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('Prompts（契约：docs/components/prompts.md）', () => {
  it('每张卡片渲染为原生 button[type=button]，数量与 items 一致', () => {
    const w = mountPrompts({ items })
    const btns = w.findAll('button')
    expect(btns).toHaveLength(3)
    for (const b of btns) expect(b.attributes('type')).toBe('button')
  })

  it('默认卡片显示 icon + label + description', () => {
    const w = mountPrompts({ items })
    const text = w.text()
    expect(text).toContain('📝')
    expect(text).toContain('Weekly report')
    expect(text).toContain('Summarize the week')
  })

  it('select 上抛完整 item（含 children 原样透传）', async () => {
    const withChildren: PromptItem = {
      key: 'writing',
      label: 'Writing helper',
      description: 'docs and polish',
      children: [
        { key: 'c1', label: 'Sub one' },
        { key: 'c2', label: 'Sub two' },
      ],
    }
    const w = mountPrompts({ items: [withChildren] })
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('select')).toEqual([[withChildren]])
  })

  it('title 缺省走 i18n（en-US 默认 Try asking）', () => {
    const w = mountPrompts({ items })
    expect(w.text()).toContain('Try asking')
  })

  it('title prop 优先于 i18n 默认', () => {
    const w = mountPrompts({ items, title: 'Quick starts' })
    expect(w.text()).toContain('Quick starts')
    expect(w.text()).not.toContain('Try asking')
  })

  it('item 插槽自定义卡片内容，点击仍由组件处理并上抛 select', async () => {
    const w = mountPrompts(
      { items },
      {
        item: '<template #item="{ item }"><b class="my-card">{{ item.label }}!</b></template>',
      },
    )
    expect(w.text()).toContain('Weekly report!')
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('select')).toEqual([[items[0]]])
  })

  it('空 items 边界：渲染 0 张卡片', () => {
    const w = mountPrompts({ items: [] })
    expect(w.findAll('button')).toHaveLength(0)
  })
})
