import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageActionFeedback from '../../../src/message/actions/MessageActionFeedback.vue'
import { setAiChatLocale } from '../../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

const wrap = '.ai-chat-message-action-feedback'
const inner = '.ai-chat-message-feedback'
const upBtn = '.ai-chat-message-feedback__btn--up'
const downBtn = '.ai-chat-message-feedback__btn--down'
const hint = '.ai-chat-message-feedback__hint'
const comment = '.ai-chat-message-feedback__comment'

describe('MessageActionFeedback 反馈动作（紧凑包装）', () => {
  it('正常：内部渲染 MessageFeedback 并透传 data-always-visible', () => {
    const w = mount(MessageActionFeedback)
    expect(w.find(wrap).exists()).toBe(true)
    expect(w.find(inner).attributes('data-always-visible')).toBeDefined()
  })

  it('正常：value 透传给内部 MessageFeedback', () => {
    const w = mount(MessageActionFeedback, { props: { value: 'up' } })
    expect(w.find(inner).classes()).toContain('ai-chat-message-feedback--rated')
    expect(w.get(upBtn).classes()).toContain('is-active')
  })

  it('正常：change 事件逐层透传（toggle 取消语义保留）', async () => {
    const w = mount(MessageActionFeedback)
    await w.get(downBtn).trigger('click')
    await w.get(downBtn).trigger('click')
    expect(w.emitted('change')).toEqual([['down'], [null]])
  })

  it('正常：评论链路完整透传（点踩 → 弱提示 → 提交）', async () => {
    const w = mount(MessageActionFeedback)
    await w.get(downBtn).trigger('click')
    await w.get(hint).trigger('click')
    await w.get(`${comment} textarea`).setValue('回答太简略')
    await w.get('.ai-chat-message-feedback__submit').trigger('click')
    expect(w.emitted('comment')).toEqual([['回答太简略']])
    expect(w.find(comment).exists()).toBe(false)
  })

  it('正常：点踩切换为点赞时评论框收起（包装不破坏原节奏）', async () => {
    const w = mount(MessageActionFeedback)
    await w.get(downBtn).trigger('click')
    await w.get(hint).trigger('click')
    expect(w.find(comment).exists()).toBe(true)
    await w.get(upBtn).trigger('click')
    expect(w.find(comment).exists()).toBe(false)
  })
})
