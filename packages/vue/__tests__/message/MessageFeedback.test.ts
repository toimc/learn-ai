import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageFeedback from '../../src/message/MessageFeedback.vue'
import { setAiChatLocale } from '../../src/locales'

// jsdom navigator.language 为 en-US，断言中文文案前显式归位
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

const upBtn = '.ai-chat-message-feedback__btn--up'
const downBtn = '.ai-chat-message-feedback__btn--down'
const root = '.ai-chat-message-feedback'
const hint = '.ai-chat-message-feedback__hint'
const comment = '.ai-chat-message-feedback__comment'

describe('MessageFeedback 消息反馈', () => {
  it('正常：渲染 👍/👎 两个按钮，aria-label 来自字典', () => {
    const w = mount(MessageFeedback)
    expect(w.find(upBtn).attributes('aria-label')).toBe('点赞')
    expect(w.find(downBtn).attributes('aria-label')).toBe('点踩')
  })

  it('正常：value 非空时根节点带 rated 修饰类', () => {
    const w = mount(MessageFeedback, { props: { value: 'up' } })
    expect(w.find(root).classes()).toContain('ai-chat-message-feedback--rated')
  })

  it('正常：未反馈时根节点无 rated 修饰类', () => {
    const w = mount(MessageFeedback)
    expect(w.find(root).classes()).not.toContain(
      'ai-chat-message-feedback--rated',
    )
  })

  it('正常：点踩 emit change down 并出现弱提示', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['down']])
    expect(w.find(hint).text()).toContain('帮助我们改进')
    expect(
      w.find(`${hint} .ai-chat-message-feedback__hint-arrow`).exists(),
    ).toBe(true)
  })

  it('正常：再点同值 toggle 取消 emit change null 提示消失', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(downBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['down'], [null]])
    expect(w.find(hint).exists()).toBe(false)
  })

  it('正常：点踩后点👍 切换为 up 且提示消失', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(upBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['down'], ['up']])
    expect(w.find(hint).exists()).toBe(false)
  })

  it('正常：点👍 后再点👍 取消为 null', async () => {
    const w = mount(MessageFeedback)
    await w.find(upBtn).trigger('click')
    await w.find(upBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['up'], [null]])
  })

  it('正常：点弱提示展开评论框，提交 emit comment 后收起并清空', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(hint).trigger('click')
    const textarea = w.find(`${comment} textarea`)
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('回答里代码有语法错误')
    await w.find('.ai-chat-message-feedback__submit').trigger('click')
    expect(w.emitted('comment')).toEqual([['回答里代码有语法错误']])
    expect(w.find(comment).exists()).toBe(false)
  })

  it('正常：再次展开评论框时 textarea 已清空（emit 后本地清空）', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(hint).trigger('click')
    await w.find(`${comment} textarea`).setValue('第一次评论')
    await w.find('.ai-chat-message-feedback__submit').trigger('click')
    await w.find(hint).trigger('click')
    expect(w.find(`${comment} textarea`).element.value).toBe('')
  })

  it('边界：空白评论提交不 emit comment', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(hint).trigger('click')
    await w.find(`${comment} textarea`).setValue('   ')
    await w.find('.ai-chat-message-feedback__submit').trigger('click')
    expect(w.emitted('comment')).toBeUndefined()
    expect(w.find(comment).exists()).toBe(true)
  })

  it('边界：取消评论收起且不 emit comment，文本清空', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(hint).trigger('click')
    await w.find(`${comment} textarea`).setValue('写了一半')
    await w.find('.ai-chat-message-feedback__cancel').trigger('click')
    expect(w.emitted('comment')).toBeUndefined()
    expect(w.find(comment).exists()).toBe(false)
    await w.find(hint).trigger('click')
    expect(w.find(`${comment} textarea`).element.value).toBe('')
  })

  it('边界：allowComment=false 时点踩无提示无评论框', async () => {
    const w = mount(MessageFeedback, { props: { allowComment: false } })
    await w.find(downBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['down']])
    expect(w.find(hint).exists()).toBe(false)
    expect(w.find(comment).exists()).toBe(false)
  })

  it('正常：外部 value 变化同步受控显示（回显历史）', async () => {
    const w = mount(MessageFeedback)
    expect(w.find(hint).exists()).toBe(false)
    await w.setProps({ value: 'down' })
    expect(w.find(hint).exists()).toBe(true)
    await w.setProps({ value: null })
    expect(w.find(hint).exists()).toBe(false)
  })

  it('正常：评论框从 down 切走时自动收起', async () => {
    const w = mount(MessageFeedback)
    await w.find(downBtn).trigger('click')
    await w.find(hint).trigger('click')
    expect(w.find(comment).exists()).toBe(true)
    await w.find(upBtn).trigger('click')
    expect(w.find(comment).exists()).toBe(false)
  })
})
