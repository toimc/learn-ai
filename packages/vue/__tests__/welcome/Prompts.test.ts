import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Prompts from '../../src/welcome/Prompts.vue'
import type { PromptItem } from '../../src/welcome/types'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

const items: PromptItem[] = [
  {
    key: 'weekly',
    label: '写一份周报',
    description: '把本周工作整理成结构化周报',
    icon: '📝',
  },
  { key: 'explain', label: '解释这段代码' },
]

describe('Prompts 渲染', () => {
  it('渲染每个 item 的 label/description/icon', () => {
    const w = mount(Prompts, { props: { items } })
    const cards = w.findAll('.ai-chat-prompts__item')
    expect(cards).toHaveLength(2)
    expect(cards[0].get('.ai-chat-prompts__label').text()).toBe('写一份周报')
    expect(cards[0].get('.ai-chat-prompts__desc').text()).toBe(
      '把本周工作整理成结构化周报',
    )
    expect(cards[0].get('.ai-chat-prompts__icon').text()).toBe('📝')
    expect(cards[1].get('.ai-chat-prompts__label').text()).toBe('解释这段代码')
    expect(cards[1].find('.ai-chat-prompts__desc').exists()).toBe(false)
    expect(cards[1].find('.ai-chat-prompts__icon').exists()).toBe(false)
  })

  it('未传 title：默认渲染字典文案「试试这样问」', () => {
    const w = mount(Prompts, { props: { items } })
    expect(w.get('.ai-chat-prompts__title').text()).toBe('试试这样问')
  })

  it('传 title：props 优先', () => {
    const w = mount(Prompts, { props: { items, title: '推荐话题' } })
    expect(w.get('.ai-chat-prompts__title').text()).toBe('推荐话题')
  })

  it('切换英文：标题响应式更新', async () => {
    const w = mount(Prompts, { props: { items } })
    setAiChatLocale('en-US', { persist: false })
    await nextTick()
    expect(w.get('.ai-chat-prompts__title').text()).toBe('Try asking')
  })

  it('空数组：不渲染卡片、标题仍在、不崩溃', () => {
    const w = mount(Prompts, { props: { items: [] } })
    expect(w.findAll('.ai-chat-prompts__item')).toHaveLength(0)
    expect(w.get('.ai-chat-prompts__title').text()).toBe('试试这样问')
  })
})

describe('Prompts 交互', () => {
  it('点击卡片 emit select 携带完整 item', async () => {
    const w = mount(Prompts, { props: { items } })
    await w.findAll('.ai-chat-prompts__item')[0].trigger('click')
    const emitted = w.emitted('select')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0] as PromptItem).toEqual(items[0])
  })

  it('children 数据透传：select payload 原样携带二级数据', async () => {
    const nested: PromptItem[] = [
      {
        key: 'writing',
        label: '写作助手',
        children: [
          { key: 'weekly', label: '帮我写周报' },
          { key: 'polish', label: '润色一段文案' },
        ],
      },
    ]
    const w = mount(Prompts, { props: { items: nested } })
    await w.findAll('.ai-chat-prompts__item')[0].trigger('click')
    const payload = w.emitted('select')![0][0] as PromptItem
    expect(payload.key).toBe('writing')
    expect(payload.children).toEqual(nested[0].children)
  })

  it('键盘可达：卡片是原生 button 且 type=button（Enter/Space 原生触发 click）', () => {
    const w = mount(Prompts, { props: { items } })
    const card = w.findAll('.ai-chat-prompts__item')[0]
    expect(card.element.tagName).toBe('BUTTON')
    expect(card.attributes('type')).toBe('button')
  })
})

describe('Prompts 布局', () => {
  it('默认：横向单行，无纵向/换行修饰类', () => {
    const w = mount(Prompts, { props: { items } })
    const classes = w.get('.ai-chat-prompts__list').classes()
    expect(classes).not.toContain('ai-chat-prompts__list--vertical')
    expect(classes).not.toContain('ai-chat-prompts__list--wrap')
  })

  it('vertical：列表加纵向修饰类', () => {
    const w = mount(Prompts, { props: { items, vertical: true } })
    expect(w.get('.ai-chat-prompts__list').classes()).toContain(
      'ai-chat-prompts__list--vertical',
    )
  })

  it('wrap：列表加换行修饰类', () => {
    const w = mount(Prompts, { props: { items, wrap: true } })
    expect(w.get('.ai-chat-prompts__list').classes()).toContain(
      'ai-chat-prompts__list--wrap',
    )
  })
})

describe('Prompts item 作用域插槽', () => {
  it('自定义卡片内容并拿到插槽 props item', () => {
    const w = mount(Prompts, {
      props: { items },
      slots: {
        item: '<template #item="{ item }"><span data-test="custom">{{ item.label }}!</span></template>',
      },
    })
    const customs = w.findAll('[data-test="custom"]')
    expect(customs).toHaveLength(2)
    expect(customs[0].text()).toBe('写一份周报!')
    expect(customs[1].text()).toBe('解释这段代码!')
    expect(w.find('.ai-chat-prompts__label').exists()).toBe(false)
  })

  it('自定义卡片仍保留点击 emit select', async () => {
    const w = mount(Prompts, {
      props: { items },
      slots: {
        item: '<template #item="{ item }"><span data-test="custom">{{ item.label }}</span></template>',
      },
    })
    await w.findAll('[data-test="custom"]')[0].trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })
})
