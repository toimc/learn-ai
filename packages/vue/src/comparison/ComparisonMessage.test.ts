import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import ComparisonMessage from './ComparisonMessage.vue'
import { markdownRendererKey } from '../composables/useMarkdownRenderer'

const FakeRenderer = defineComponent({
  props: { content: { type: String, default: '' } },
  setup: (p: { content: string }) => () =>
    h('div', { class: 'fake-renderer' }, p.content),
})

function mountCM(
  props: Record<string, unknown>,
  slots?: Record<string, unknown>,
) {
  return mount(ComparisonMessage, {
    props,
    slots,
    global: {
      provide: { [markdownRendererKey as symbol]: FakeRenderer as Component },
    },
  })
}

describe('ComparisonMessage', () => {
  it('默认渲染两列与两按钮，文案正确', () => {
    const w = mountCM({ left: 'AAA', right: 'BBB' })
    const labels = w.findAll('.ai-chat-comparison__label')
    expect(labels[0].text()).toBe('回复 A')
    expect(labels[1].text()).toBe('回复 B')
    const btns = w.findAll('.ai-chat-comparison__btn')
    expect(btns).toHaveLength(2)
    expect(btns[0].text()).toBe('我更喜欢这个回复')
  })

  it('点击左/右按钮分别 emit prefer，chosen 对应', async () => {
    const w = mountCM({ left: 'AAA', right: 'BBB' })
    const btns = w.findAll('.ai-chat-comparison__btn')
    await btns[0].trigger('click')
    expect(w.emitted('prefer')?.[0]?.[0]).toEqual({
      chosen: 'A',
      left: 'AAA',
      right: 'BBB',
    })
    await btns[1].trigger('click')
    const events = w.emitted('prefer')!
    expect(events[1][0]).toMatchObject({ chosen: 'B' })
  })

  it('chosen 受控时高亮与父值一致', () => {
    const w = mountCM({ left: 'A', right: 'B', chosen: 'B' })
    const cols = w.findAll('.ai-chat-comparison__col')
    expect(cols[1].classes()).toContain('is-selected')
    expect(cols[0].classes()).not.toContain('is-selected')
  })

  it('disabled 时按钮不 emit', async () => {
    const w = mountCM({ left: 'A', right: 'B', disabled: true })
    await w.findAll('.ai-chat-comparison__btn')[0].trigger('click')
    expect(w.emitted('prefer')).toBeUndefined()
  })

  it('slot 覆盖 props 内容', () => {
    const w = mountCM(
      { left: 'A', right: 'B' },
      {
        left: () => h('span', { class: 'sl' }, '自定义左'),
        right: () => h('span', { class: 'sr' }, '自定义右'),
      },
    )
    expect(w.find('.sl').text()).toBe('自定义左')
    expect(w.find('.sr').text()).toBe('自定义右')
    expect(w.find('.fake-renderer').exists()).toBe(false)
  })
})
