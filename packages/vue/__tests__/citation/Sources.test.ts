import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MessageSource } from '@toimc/core'
import Sources from '../../src/citation/Sources.vue'
import { isSafeHttpUrl } from '../../src/citation/url'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeSource(overrides: Partial<MessageSource> = {}): MessageSource {
  return {
    id: 'src_1',
    type: 'url',
    title: 'Vue 3 指南',
    url: 'https://vuejs.org/guide/introduction.html',
    snippet: 'Vue 是一款用于构建用户界面的 JavaScript 框架。',
    ...overrides,
  }
}

function makeSources(n: number): MessageSource[] {
  return Array.from({ length: n }, (_, i) =>
    makeSource({ id: `src_${i + 1}`, title: `文档 ${i + 1}` }),
  )
}

describe('isSafeHttpUrl 纯函数（URL 白名单）', () => {
  it.each([
    ['https://vuejs.org/guide', true],
    ['http://example.com', true],
    ['HTTPS://EXAMPLE.COM/PATH', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>', false],
    ['vbscript:msgbox', false],
    ['ftp://example.com/file', false],
    ['not a url', false],
    ['', false],
  ])('isSafeHttpUrl(%j) === %s', (input, expected) => {
    expect(isSafeHttpUrl(input)).toBe(expected)
  })
})

describe('Sources 折叠列表模式（默认）', () => {
  it('正常：默认折叠，标题为 i18n 计数文案', () => {
    const w = mount(Sources, { props: { sources: makeSources(2) } })
    expect(w.get('.ai-chat-sources__title').text()).toBe('来源 2 条')
    expect(w.find('.ai-chat-sources__list').exists()).toBe(false)
    expect(w.get('.ai-chat-sources__header').attributes('aria-expanded')).toBe(
      'false',
    )
  })

  it('正常：点击标题展开列表', async () => {
    const w = mount(Sources, { props: { sources: makeSources(2) } })
    await w.get('.ai-chat-sources__header').trigger('click')
    expect(w.find('.ai-chat-sources__list').exists()).toBe(true)
    expect(w.get('.ai-chat-sources__header').attributes('aria-expanded')).toBe(
      'true',
    )
    await w.get('.ai-chat-sources__header').trigger('click')
    expect(w.find('.ai-chat-sources__list').exists()).toBe(false)
  })

  it('正常：title prop 覆盖默认文案', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(3), title: '参考资料' },
    })
    expect(w.get('.ai-chat-sources__title').text()).toBe('参考资料')
  })

  it('正常：defaultOpen 初始即展开', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(1), defaultOpen: true },
    })
    expect(w.find('.ai-chat-sources__list').exists()).toBe(true)
  })

  it('正常：url 型渲染外链并 emit select(source, index)', async () => {
    const w = mount(Sources, { props: { sources: makeSources(2) } })
    await w.get('.ai-chat-sources__header').trigger('click')
    const link = w.get('a.ai-chat-sources__link')
    expect(link.attributes('href')).toBe(
      'https://vuejs.org/guide/introduction.html',
    )
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.get('.ai-chat-sources__link-index').text()).toBe('1')
    expect(link.get('.ai-chat-sources__link-title').text()).toBe('文档 1')

    await link.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('select')![0]).toEqual([
      expect.objectContaining({ id: 'src_1' }),
      0,
    ])
  })

  it('正常：document 型渲染非链接卡（标题 + snippet）并 emit select', async () => {
    const w = mount(Sources, {
      props: {
        sources: [
          makeSource({
            type: 'document',
            url: undefined,
            snippet: '本地知识库片段',
          }),
        ],
      },
    })
    await w.get('.ai-chat-sources__header').trigger('click')
    expect(w.find('a').exists()).toBe(false)
    const doc = w.get('button.ai-chat-sources__doc')
    expect(doc.text()).toContain('Vue 3 指南')
    expect(w.get('.ai-chat-sources__doc-snippet').text()).toBe('本地知识库片段')

    await doc.trigger('click')
    expect(w.emitted('select')![0]).toEqual([
      expect.objectContaining({ type: 'document' }),
      0,
    ])
  })

  it('安全：非 http(s) 的 url 型来源降级为非链接卡', async () => {
    const w = mount(Sources, {
      props: { sources: [makeSource({ url: 'javascript:alert(1)' })] },
    })
    await w.get('.ai-chat-sources__header').trigger('click')
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button.ai-chat-sources__doc').exists()).toBe(true)
  })

  it('正常：source 作用域插槽覆盖默认卡', async () => {
    const w = mount(Sources, {
      props: { sources: makeSources(2), defaultOpen: true },
      slots: {
        source: `<template #source="{ source, index }">
          <span class="custom-src">{{ index }}-{{ source.id }}</span>
        </template>`,
      },
    })
    const items = w.findAll('.custom-src')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toBe('0-src_1')
    expect(items[1]!.text()).toBe('1-src_2')
  })

  it('边界：空 sources 渲染标题「来源 0 条」且可展开为空列表', async () => {
    const w = mount(Sources, { props: { sources: [] } })
    expect(w.get('.ai-chat-sources__title').text()).toBe('来源 0 条')
    await w.get('.ai-chat-sources__header').trigger('click')
    expect(w.findAll('.ai-chat-sources__item')).toHaveLength(0)
  })
})

describe('Sources inline 徽标模式', () => {
  it('正常：默认 maxInline=3，超出折叠 +N', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(5), inline: true },
    })
    const badges = w.findAll('.ai-chat-sources__badge')
    expect(badges).toHaveLength(4) // 3 个序号徽标 + 1 个 +2
    expect(badges[0]!.text()).toBe('1')
    expect(badges[1]!.text()).toBe('2')
    expect(badges[2]!.text()).toBe('3')
    expect(badges[3]!.text()).toBe('+2')
  })

  it('正常：不超过 maxInline 时无折叠按钮', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(3), inline: true },
    })
    expect(w.findAll('.ai-chat-sources__badge')).toHaveLength(3)
    expect(w.find('.ai-chat-sources__overflow').exists()).toBe(false)
  })

  it('正常：点击徽标 emit select 带原始数组 index', async () => {
    const w = mount(Sources, {
      props: { sources: makeSources(3), inline: true },
    })
    await w.findAll('.ai-chat-sources__badge')[1]!.trigger('click')
    expect(w.emitted('select')![0]).toEqual([
      expect.objectContaining({ id: 'src_2' }),
      1,
    ])
  })

  it('正常：+N 展开Popover 显示剩余来源，点击 emit 正确 index', async () => {
    const w = mount(Sources, {
      props: { sources: makeSources(5), inline: true },
    })
    expect(w.find('.ai-chat-sources__popover').exists()).toBe(false)

    await w.get('.ai-chat-sources__badge--more').trigger('click')
    expect(w.find('.ai-chat-sources__popover').exists()).toBe(true)
    expect(
      w.get('.ai-chat-sources__badge--more').attributes('aria-expanded'),
    ).toBe('true')

    const links = w.findAll('.ai-chat-sources__popover-item')
    expect(links).toHaveLength(2)
    await links[1]!.trigger('click')
    expect(w.emitted('select')![0]).toEqual([
      expect.objectContaining({ id: 'src_5' }),
      4,
    ])
  })

  it('边界：maxInline=0 时全部进 Popover', async () => {
    const w = mount(Sources, {
      props: { sources: makeSources(2), inline: true, maxInline: 0 },
    })
    expect(w.findAll('.ai-chat-sources__badge--seq')).toHaveLength(0)
    expect(w.get('.ai-chat-sources__badge--more').text()).toBe('+2')
    await w.get('.ai-chat-sources__badge--more').trigger('click')
    expect(w.findAll('.ai-chat-sources__popover-item')).toHaveLength(2)
  })

  it('正常：maxInline 自定义生效', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(5), inline: true, maxInline: 2 },
    })
    expect(w.findAll('.ai-chat-sources__badge--seq')).toHaveLength(2)
    expect(w.get('.ai-chat-sources__badge--more').text()).toBe('+3')
  })

  it('正常：显式传入 title 时在徽标行前渲染', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(2), inline: true, title: '引用' },
    })
    expect(w.get('.ai-chat-sources__inline-title').text()).toBe('引用')
  })

  it('边界：inline 模式默认不渲染 title（避免与徽标冗余）', () => {
    const w = mount(Sources, {
      props: { sources: makeSources(2), inline: true },
    })
    expect(w.find('.ai-chat-sources__inline-title').exists()).toBe(false)
  })
})
