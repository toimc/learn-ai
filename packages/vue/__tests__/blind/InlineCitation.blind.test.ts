/**
 * 双盲测试：InlineCitation
 * 契约来源：packages/docs/components/inline-citation.md（未读实现源码）
 * 预期值来源：文档写明的默认值/行为（MessageSource 协议来自 @toimc/core 类型契约）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { InlineCitation, setAiChatLocale } from '@toimc/vue'
import type { MessageSource } from '@toimc/core'
import { clickEl, domText, findExactText, rendered } from './helpers'

const urlSource: MessageSource = {
  id: 'src_url',
  type: 'url',
  title: 'Vue 3 Guide',
  url: 'https://vuejs.org/guide/introduction.html',
  snippet: 'Vue is a progressive framework.',
}
const docSource: MessageSource = {
  id: 'src_doc',
  type: 'document',
  title: 'Internal Knowledge Base',
  snippet: 'reactive is built on Proxy',
}

const mounted: VueWrapper[] = []

function mountCitation(props: {
  index: number
  sources: MessageSource[]
  cardWidth?: number
}) {
  const w = mount(InlineCitation, { props, attachTo: document.body })
  mounted.push(w)
  return w
}

/** 文档：hover / focus 弹出悬浮卡。jsdom 无 hover，用 focus 事件族唤起 */
async function focusBadge(w: VueWrapper) {
  const badge = w.find('button')
  const target = badge.exists() ? badge : w
  await target.trigger('focus')
  await target.trigger('focusin')
}

/** 卡片被误关时重开 */
async function ensureOpen(w: VueWrapper) {
  if (!rendered(findExactText(w, urlSource.title ?? ''))) await focusBadge(w)
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('InlineCitation（契约：docs/components/inline-citation.md）', () => {
  it('渲染角标编号：index 原样展示', () => {
    const w = mountCitation({ index: 7, sources: [urlSource] })
    expect(w.text()).toContain('7')
  })

  it('focus 角标后悬浮卡以纯文本展示标题与片段（focus 前不可见）', async () => {
    const w = mountCitation({ index: 1, sources: [urlSource] })
    expect(rendered(findExactText(w, 'Vue 3 Guide'))).toBe(false)
    await focusBadge(w)
    expect(rendered(findExactText(w, 'Vue 3 Guide'))).toBe(true)
    expect(domText(w)).toContain('Vue is a progressive framework.')
  })

  it('http(s) url 通过白名单校验后渲染外链锚点', async () => {
    const w = mountCitation({ index: 1, sources: [urlSource] })
    await focusBadge(w)
    const link = document.querySelector(
      'a[href="https://vuejs.org/guide/introduction.html"]',
    )
    expect(link).not.toBeNull()
  })

  it('javascript: 协议 url 自动降级为非链接（无锚点，标题仍可见）', async () => {
    const evil: MessageSource = {
      ...urlSource,
      id: 'evil',
      url: 'javascript:alert(1)',
    }
    const w = mountCitation({ index: 1, sources: [evil] })
    await focusBadge(w)
    expect(document.querySelector('a')).toBeNull()
    expect(rendered(findExactText(w, 'Vue 3 Guide'))).toBe(true)
  })

  it('点击卡片内来源标题触发 select，payload 为完整 source 对象', async () => {
    const w = mountCitation({ index: 1, sources: [urlSource] })
    await focusBadge(w)
    const link = document.querySelector('a')
    if (!link) throw new Error('悬浮卡内应存在可点击的来源标题（外链形态）')
    clickEl(link)
    await nextTick()
    expect(w.emitted('select')).toEqual([[urlSource]])
  })

  it('多来源卡片显示 当前/总数 计数，且一次只展示一个来源', async () => {
    const w = mountCitation({ index: 1, sources: [urlSource, docSource] })
    await focusBadge(w)
    expect(domText(w)).toMatch(/1\s*\/\s*2/)
    expect(rendered(findExactText(w, 'Vue 3 Guide'))).toBe(true)
    expect(rendered(findExactText(w, 'Internal Knowledge Base'))).toBe(false)
  })

  it('prev/next 循环切换：能切到第二个来源，也能再切回第一个', async () => {
    const w = mountCitation({ index: 1, sources: [urlSource, docSource] })
    await focusBadge(w)

    // 任找一颗能切到来源二的控件（两来源循环，prev/next 都会离开来源一）
    let reachedSecond = false
    for (let round = 0; round < 4 && !reachedSecond; round++) {
      for (const b of Array.from(document.querySelectorAll('button'))) {
        clickEl(b)
        await nextTick()
        if (rendered(findExactText(w, 'Internal Knowledge Base'))) {
          reachedSecond = true
          break
        }
        await ensureOpen(w)
      }
    }
    expect(reachedSecond).toBe(true)

    // 再任找一颗能切回来源一的控件（循环，不锁死在末端）
    let backToFirst = false
    for (let round = 0; round < 4 && !backToFirst; round++) {
      for (const b of Array.from(document.querySelectorAll('button'))) {
        clickEl(b)
        await nextTick()
        if (rendered(findExactText(w, 'Vue 3 Guide'))) {
          backToFirst = true
          break
        }
        if (!rendered(findExactText(w, 'Internal Knowledge Base')))
          await focusBadge(w)
      }
    }
    expect(backToFirst).toBe(true)
  })
})
