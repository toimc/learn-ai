import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { MessageSource } from '@toimc/core'
import InlineCitation from '../../src/citation/InlineCitation.vue'
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

async function openCard(w: ReturnType<typeof mount>) {
  await w.get('.ai-chat-inline-citation').trigger('mouseenter')
}

describe('InlineCitation 角标渲染', () => {
  it('正常：渲染上标角标按钮并显示编号', () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    const trigger = w.get('button.ai-chat-inline-citation__trigger')
    expect(trigger.text()).toBe('1')
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.attributes('aria-label')).toBe('来源')
  })

  it('边界：未悬浮时卡片不存在', () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(false)
  })

  it('边界：空 sources 时 hover 不弹卡', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [] },
    })
    await openCard(w)
    expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(false)
  })
})

describe('InlineCitation 悬浮卡内容', () => {
  it('正常：hover 弹卡显示标题与 snippet', async () => {
    const w = mount(InlineCitation, {
      props: { index: 2, sources: [makeSource()] },
    })
    await openCard(w)
    expect(w.get('.ai-chat-inline-citation__title').text()).toBe('Vue 3 指南')
    expect(w.get('.ai-chat-inline-citation__snippet').text()).toBe(
      'Vue 是一款用于构建用户界面的 JavaScript 框架。',
    )
  })

  it('正常：默认卡片宽度 300px，可由 cardWidth 覆盖', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    expect(
      w.get('.ai-chat-inline-citation__card').attributes('style'),
    ).toContain('width: 300px')

    const w2 = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()], cardWidth: 360 },
    })
    await openCard(w2)
    expect(
      w2.get('.ai-chat-inline-citation__card').attributes('style'),
    ).toContain('width: 360px')
  })

  it('正常：url 型标题渲染外链（_blank + noopener noreferrer）', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    const link = w.get('a.ai-chat-inline-citation__title')
    expect(link.attributes('href')).toBe(
      'https://vuejs.org/guide/introduction.html',
    )
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(w.get('.ai-chat-inline-citation__link').text()).toBe('查看来源')
  })

  it('安全：javascript: 协议不渲染任何外链，标题降级为非链接按钮', async () => {
    const w = mount(InlineCitation, {
      props: {
        index: 1,
        sources: [makeSource({ url: 'javascript:alert(1)' })],
      },
    })
    await openCard(w)
    expect(w.find('a').exists()).toBe(false)
    expect(w.get('button.ai-chat-inline-citation__title').text()).toBe(
      'Vue 3 指南',
    )
    expect(w.find('.ai-chat-inline-citation__link').exists()).toBe(false)
  })

  it('边界：无 snippet 时不渲染 snippet 节点', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource({ snippet: undefined })] },
    })
    await openCard(w)
    expect(w.find('.ai-chat-inline-citation__snippet').exists()).toBe(false)
  })

  it('边界：单来源不渲染轮播导航', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    expect(w.find('.ai-chat-inline-citation__nav').exists()).toBe(false)
  })
})

describe('InlineCitation 多来源轮播', () => {
  it('正常：next/prev 循环切换并显示计数', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: makeSources(3) },
    })
    await openCard(w)
    expect(w.get('.ai-chat-inline-citation__count').text()).toBe('1/3')

    await w.get('.ai-chat-inline-citation__nav-next').trigger('click')
    expect(w.get('.ai-chat-inline-citation__count').text()).toBe('2/3')
    expect(w.get('.ai-chat-inline-citation__title').text()).toBe('文档 2')

    await w.get('.ai-chat-inline-citation__nav-next').trigger('click')
    expect(w.get('.ai-chat-inline-citation__count').text()).toBe('3/3')

    // 循环回 1/3
    await w.get('.ai-chat-inline-citation__nav-next').trigger('click')
    expect(w.get('.ai-chat-inline-citation__count').text()).toBe('1/3')

    // prev 也循环：1/3 -> 3/3
    await w.get('.ai-chat-inline-citation__nav-prev').trigger('click')
    expect(w.get('.ai-chat-inline-citation__count').text()).toBe('3/3')
  })

  it('正常：导航按钮带 i18n aria-label', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: makeSources(2) },
    })
    await openCard(w)
    expect(
      w.get('.ai-chat-inline-citation__nav-prev').attributes('aria-label'),
    ).toBe('上一个来源')
    expect(
      w.get('.ai-chat-inline-citation__nav-next').attributes('aria-label'),
    ).toBe('下一个来源')
  })
})

describe('InlineCitation 事件与交互关闭', () => {
  it('正常：点击标题 emit select（载荷为当前来源对象）', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    await w.get('.ai-chat-inline-citation__title').trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('select')![0]).toEqual([
      expect.objectContaining({ id: 'src_1', title: 'Vue 3 指南' }),
    ])
  })

  it('正常：轮播到第二个后点击标题 emit 第二个来源', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: makeSources(2) },
    })
    await openCard(w)
    await w.get('.ai-chat-inline-citation__nav-next').trigger('click')
    await w.get('.ai-chat-inline-citation__title').trigger('click')
    expect(w.emitted('select')![0][0]).toMatchObject({ id: 'src_2' })
  })

  it('键盘：focusin 打开卡片', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await w.get('.ai-chat-inline-citation').trigger('focusin')
    expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(true)
  })

  it('键盘：焦点移出组件关闭，组件内转移不关', async () => {
    // attachTo 让 jsdom 的 element.focus()/blur() 真正更新 activeElement（detached DOM 不生效）
    const w = mount(InlineCitation, {
      props: { index: 1, sources: makeSources(2) },
      attachTo: document.body,
    })
    try {
      await openCard(w)
      // 焦点从角标移向卡片内导航按钮：不关
      const navNext = w.get('.ai-chat-inline-citation__nav-next')
      navNext.element.focus()
      await w.get('.ai-chat-inline-citation').trigger('focusout')
      expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(true)

      // 焦点移出到组件外：关
      navNext.element.blur()
      await w.get('.ai-chat-inline-citation').trigger('focusout')
      expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(false)
    } finally {
      w.unmount()
    }
  })

  it('键盘：Esc 关闭卡片', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    await w.get('.ai-chat-inline-citation__trigger').trigger('keydown', {
      key: 'Escape',
    })
    expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(false)
  })

  it('鼠标：mouseleave 且焦点在组件内时不关闭（键盘用户不被误关）', async () => {
    // attachTo 让 jsdom 的 element.focus() 真正更新 activeElement（detached DOM 不生效）
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
      attachTo: document.body,
    })
    try {
      w.get('.ai-chat-inline-citation__trigger').element.focus()
      await openCard(w)
      await w.get('.ai-chat-inline-citation').trigger('mouseleave')
      expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(true)
    } finally {
      w.unmount()
    }
  })

  it('鼠标：mouseleave 且焦点在组件外时关闭', async () => {
    const w = mount(InlineCitation, {
      props: { index: 1, sources: [makeSource()] },
    })
    await openCard(w)
    await w.get('.ai-chat-inline-citation').trigger('mouseleave')
    expect(w.find('.ai-chat-inline-citation__card').exists()).toBe(false)
  })
})
