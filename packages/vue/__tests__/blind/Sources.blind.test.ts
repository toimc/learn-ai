/**
 * 双盲测试：Sources
 * 契约来源：packages/docs/components/sources.md（未读实现源码）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { Sources, setAiChatLocale } from '@toimc/vue'
import type { MessageSource } from '@toimc/core'
import {
  clickEl,
  domText,
  findExactText,
  rendered,
  requireExactText,
} from './helpers'

const urlSrc: MessageSource = {
  id: 'u1',
  type: 'url',
  title: 'Vue Guide',
  url: 'https://vuejs.org/x',
}
const docSrc: MessageSource = {
  id: 'd1',
  type: 'document',
  title: 'Internal KB',
  snippet: 'proxy internals',
}
const five: MessageSource[] = [1, 2, 3, 4, 5].map((i) => ({
  id: `s${i}`,
  type: 'document' as const,
  title: `Doc-${i}`,
  snippet: `snippet-${i}`,
}))

const mounted: VueWrapper[] = []

interface SourcesProps {
  sources: MessageSource[]
  title?: string
  inline?: boolean
  maxInline?: number
  defaultOpen?: boolean
}

function mountSources(props: SourcesProps, slots?: Record<string, string>) {
  const w = mount(Sources, { props, slots, attachTo: document.body })
  mounted.push(w)
  return w
}

function clickText(w: VueWrapper, text: string) {
  clickEl(requireExactText(w, text))
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})

describe('Sources（契约：docs/components/sources.md）', () => {
  it('默认折叠列表：标题可见、来源项未展开；点击标题展开', async () => {
    const w = mountSources({ sources: [urlSrc, docSrc], title: 'References' })
    expect(w.text()).toContain('References')
    expect(rendered(findExactText(w, 'Vue Guide'))).toBe(false)
    clickText(w, 'References')
    await nextTick()
    expect(rendered(findExactText(w, 'Vue Guide'))).toBe(true)
  })

  it('defaultOpen 初始展开：url 型渲染外链（_blank + noopener noreferrer），document 型渲染非链接卡', () => {
    const w = mountSources({ sources: [urlSrc, docSrc], defaultOpen: true })
    const link = document.querySelector<HTMLAnchorElement>(
      'a[href="https://vuejs.org/x"]',
    )
    expect(link).not.toBeNull()
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toContain('noopener')
    expect(link?.rel).toContain('noreferrer')
    // document 型为非链接卡（标题 + snippet），全卡只有 url 型一个锚点
    expect(rendered(findExactText(w, 'Internal KB'))).toBe(true)
    expect(rendered(findExactText(w, 'proxy internals'))).toBe(true)
    expect(document.querySelectorAll('a')).toHaveLength(1)
  })

  it('select 事件回传 (source, 原始下标)', async () => {
    const w = mountSources({ sources: [docSrc, urlSrc], defaultOpen: true })
    clickText(w, 'Vue Guide')
    await nextTick()
    expect(w.emitted('select')).toEqual([[urlSrc, 1]])
  })

  it('url 校验不通过（javascript:）降级为非链接卡', async () => {
    const evil: MessageSource = {
      ...urlSrc,
      id: 'evil',
      url: 'javascript:alert(1)',
    }
    const w = mountSources({ sources: [evil], defaultOpen: true })
    expect(document.querySelector('a')).toBeNull()
    expect(rendered(findExactText(w, 'Vue Guide'))).toBe(true)
  })

  it('inline 模式默认 maxInline=3：超出折叠为 +N，第 4/5 个来源不可见；未传 title 不渲染默认标题', () => {
    setAiChatLocale('zh-CN')
    const w = mountSources({ sources: five, inline: true })
    expect(domText(w)).toContain('+2')
    expect(rendered(findExactText(w, 'Doc-4'))).toBe(false)
    expect(rendered(findExactText(w, 'Doc-5'))).toBe(false)
    // 文档：inline 模式下 title 仅显式传入时渲染（默认 i18n 计数文案为「来源 N 条」）
    expect(domText(w)).not.toContain('来源')
  })

  it('inline 模式显式传入 title 时渲染', () => {
    setAiChatLocale('zh-CN')
    const w = mountSources({ sources: five, inline: true, title: '引用列表' })
    expect(domText(w)).toContain('引用列表')
  })

  it('inline 点击 +N 展开 Popover 显示剩余来源，点击项 select 带原始下标', async () => {
    const w = mountSources({ sources: five, inline: true })
    clickText(w, '+2')
    await nextTick()
    expect(rendered(findExactText(w, 'Doc-4'))).toBe(true)
    clickText(w, 'Doc-4')
    await nextTick()
    expect(w.emitted('select')).toEqual([[five[3], 3]])
  })

  it('source 作用域插槽透出 { source, index }（仅折叠列表模式）', () => {
    const w = mountSources(
      { sources: five.slice(0, 2), defaultOpen: true },
      {
        source:
          '<template #source="{ source, index }"><span class="my-source">{{ index }}:{{ source.title }}</span></template>',
      },
    )
    expect(rendered(findExactText(w, '0:Doc-1'))).toBe(true)
    expect(rendered(findExactText(w, '1:Doc-2'))).toBe(true)
  })
})
