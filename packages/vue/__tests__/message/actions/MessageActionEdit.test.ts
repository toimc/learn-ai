import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageActionEdit from '../../../src/message/actions/MessageActionEdit.vue'
import { setAiChatLocale } from '../../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

const panel = '.ai-chat-message-action-edit'
const trigger = 'button.ai-chat-message-action'

describe('MessageActionEdit 行内编辑', () => {
  it('正常：空闲态渲染铅笔按钮，title 默认取字典 messageActions.edit', () => {
    const w = mount(MessageActionEdit, { props: { initialText: '原文' } })
    expect(w.get(trigger).attributes('title')).toBe('编辑')
    expect(w.find(panel).exists()).toBe(false)
  })

  it('正常：点击展开编辑面板，textarea 预填 initialText', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '原文内容' } })
    await w.get(trigger).trigger('click')
    const textarea = w.get(`${panel} textarea`)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('原文内容')
    expect(textarea.attributes('placeholder')).toBe('编辑消息内容…')
  })

  it('正常：placeholder prop 覆盖默认占位', async () => {
    const w = mount(MessageActionEdit, {
      props: { initialText: 'x', placeholder: '改一改' },
    })
    await w.get(trigger).trigger('click')
    expect(w.get(`${panel} textarea`).attributes('placeholder')).toBe('改一改')
  })

  it('正常：修改后保存 emit edit（trim 后），面板收起', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '旧' } })
    await w.get(trigger).trigger('click')
    await w.get(`${panel} textarea`).setValue('  新内容  ')
    await w.get('.ai-chat-message-action-edit__save').trigger('click')
    expect(w.emitted('edit')).toEqual([['新内容']])
    expect(w.find(panel).exists()).toBe(false)
    expect(w.emitted('cancel')).toBeUndefined()
  })

  it('边界：空白内容保存不 emit，面板保持展开', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '旧' } })
    await w.get(trigger).trigger('click')
    await w.get(`${panel} textarea`).setValue('   ')
    await w.get('.ai-chat-message-action-edit__save').trigger('click')
    expect(w.emitted('edit')).toBeUndefined()
    expect(w.find(panel).exists()).toBe(true)
  })

  it('正常：取消 emit cancel 且面板收起', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '旧' } })
    await w.get(trigger).trigger('click')
    await w.get('.ai-chat-message-action-edit__cancel').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('edit')).toBeUndefined()
    expect(w.find(panel).exists()).toBe(false)
  })

  it('正常：保存后再次进入编辑，草稿重置为最新 initialText', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '旧' } })
    await w.get(trigger).trigger('click')
    await w.get(`${panel} textarea`).setValue('新内容')
    await w.get('.ai-chat-message-action-edit__save').trigger('click')
    // 宿主成功后同步消息内容 → initialText 更新
    await w.setProps({ initialText: '新内容' })
    await w.get(trigger).trigger('click')
    const textarea = w.get(`${panel} textarea`).element as HTMLTextAreaElement
    expect(textarea.value).toBe('新内容')
  })

  it('正常：取消后再进入编辑，草稿回到 initialText（半稿不残留）', async () => {
    const w = mount(MessageActionEdit, { props: { initialText: '旧' } })
    await w.get(trigger).trigger('click')
    await w.get(`${panel} textarea`).setValue('写了一半')
    await w.get('.ai-chat-message-action-edit__cancel').trigger('click')
    await w.get(trigger).trigger('click')
    const textarea = w.get(`${panel} textarea`).element as HTMLTextAreaElement
    expect(textarea.value).toBe('旧')
  })
})
