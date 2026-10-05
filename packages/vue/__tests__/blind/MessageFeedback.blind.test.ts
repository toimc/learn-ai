/**
 * 双盲测试：MessageFeedback
 * 契约来源：packages/docs/components/message-feedback.md（未读实现源码）
 * 流程文案以中文文档写明：「帮助我们改进 →」、提交/取消 —— 用 zh-CN 断言
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MessageFeedback, setAiChatLocale } from '@toimc/vue'

const mounted: VueWrapper[] = []

function mountFeedback(props: Record<string, unknown> = {}) {
  const w = mount(MessageFeedback, { props, attachTo: document.body })
  mounted.push(w)
  return w
}

/** 找文本包含 sub 的按钮 */
function buttonByText(w: VueWrapper, sub: string) {
  return w.findAll('button').find((b) => b.text().includes(sub))
}

/** 未反馈态两颗按钮（👍/👎），点击到指定值 */
async function clickUntil(w: VueWrapper, value: 'up' | 'down') {
  const btns = w.findAll('button')
  await btns[0].trigger('click')
  const first = w.emitted('change')?.[0]?.[0]
  if (first !== value) await btns[1].trigger('click')
  expect(w.emitted('change')?.some((e) => e[0] === value)).toBe(true)
}

/** 走完 toggle → 弱提示 → 展开评论框 的两段交互 */
async function openCommentBox(w: VueWrapper) {
  await clickUntil(w, 'down')
  const hint = buttonByText(w, '帮助我们改进')
  if (!hint) throw new Error('点踩后应出现「帮助我们改进」弱提示按钮')
  await hint.trigger('click')
  if (!w.find('textarea').exists()) throw new Error('点击弱提示后应展开评论框')
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('zh-CN'))

describe('MessageFeedback（契约：docs/components/message-feedback.md）', () => {
  it('toggle：点击得 up/down，再点同值得 null（取消）', async () => {
    const w = mountFeedback()
    const btns = w.findAll('button')
    expect(btns).toHaveLength(2)
    await btns[0].trigger('click')
    const v = w.emitted('change')?.[0]?.[0] as 'up' | 'down'
    expect(['up', 'down']).toContain(v)
    await btns[0].trigger('click')
    expect(w.emitted('change')?.at(-1)).toEqual([null])
  })

  it('点另一个值则切换', async () => {
    const w = mountFeedback()
    const btns = w.findAll('button')
    await btns[0].trigger('click')
    const v = w.emitted('change')?.[0]?.[0] as 'up' | 'down'
    await btns[1].trigger('click')
    expect(w.emitted('change')?.at(-1)).toEqual([v === 'up' ? 'down' : 'up'])
  })

  it('点踩后出现弱提示按钮且不自动展开评论框；点击提示才展开', async () => {
    const w = mountFeedback()
    const btns = w.findAll('button')
    await btns[0].trigger('click')
    if (w.emitted('change')?.[0]?.[0] !== 'down') await btns[1].trigger('click')
    // 未反馈 2 颗 + 弱提示 1 颗
    expect(w.findAll('button')).toHaveLength(3)
    expect(
      w.findAll('button').filter((b) => b.text().includes('帮助我们改进')),
    ).toHaveLength(1)
    // 不自动展开
    expect(w.find('textarea').exists()).toBe(false)
    const hint = buttonByText(w, '帮助我们改进')
    if (!hint) throw new Error('弱提示按钮应存在')
    await hint.trigger('click')
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('空文本点提交不触发 comment', async () => {
    const w = mountFeedback()
    await openCommentBox(w)
    const submit = buttonByText(w, '提交')
    if (!submit) throw new Error('评论框内应有提交按钮')
    await submit.trigger('click')
    expect(w.emitted('comment')).toBeUndefined()
  })

  it('非空提交：comment 上抛文本，emit 后收起且草稿清空', async () => {
    const w = mountFeedback()
    await openCommentBox(w)
    await w.find('textarea').setValue('Great answer')
    const submit = buttonByText(w, '提交')
    if (!submit) throw new Error('评论框内应有提交按钮')
    await submit.trigger('click')
    expect(w.emitted('comment')).toEqual([['Great answer']])
    expect(w.find('textarea').exists()).toBe(false)
    // 草稿已清空：重新展开验证
    const hint = buttonByText(w, '帮助我们改进')
    if (hint) {
      await hint.trigger('click')
      const ta = w.find('textarea')
      if (ta.exists())
        expect((ta.element as HTMLTextAreaElement).value).toBe('')
    }
  })

  it('取消：不触发 comment、收起并清空草稿', async () => {
    const w = mountFeedback()
    await openCommentBox(w)
    await w.find('textarea').setValue('draft text')
    const cancel = buttonByText(w, '取消')
    if (!cancel) throw new Error('评论框内应有取消按钮')
    await cancel.trigger('click')
    expect(w.emitted('comment')).toBeUndefined()
    expect(w.find('textarea').exists()).toBe(false)
    const hint = buttonByText(w, '帮助我们改进')
    if (hint) {
      await hint.trigger('click')
      const ta = w.find('textarea')
      if (ta.exists())
        expect((ta.element as HTMLTextAreaElement).value).toBe('')
    }
  })

  it('allowComment=false：点踩后无弱提示、无评论框', async () => {
    const w = mountFeedback({ allowComment: false })
    const btns = w.findAll('button')
    await btns[0].trigger('click')
    if (w.emitted('change')?.[0]?.[0] !== 'down') await btns[1].trigger('click')
    expect(w.findAll('button')).toHaveLength(2)
    expect(w.find('textarea').exists()).toBe(false)
  })

  it('受控 value 回显：value=up 时点两颗按钮分别得 down 与 null', async () => {
    const w = mountFeedback({ value: 'up' })
    const btns = w.findAll('button')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    const flat = (w.emitted('change') ?? []).map((e) => e[0])
    expect(flat).toHaveLength(2)
    expect(flat).toContain('down')
    expect(flat).toContain(null)
  })
})
