import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolConfirmation from '../../src/tool-call/ToolConfirmation.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function mountConfirmation(
  props: InstanceType<typeof ToolConfirmation>['$props'],
) {
  return mount(ToolConfirmation, { props })
}

describe('ToolConfirmation 待审批态', () => {
  it('渲染标题、工具名、默认说明与格式化参数', () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      arguments: { path: '/tmp/x' },
      status: 'awaiting-approval',
    })
    expect(w.get('.ai-chat-tool-confirmation__title').text()).toBe(
      '需要确认操作',
    )
    expect(w.get('.ai-chat-tool-confirmation__tool-name').text()).toBe(
      'delete_file',
    )
    expect(w.get('.ai-chat-tool-confirmation__desc').text()).toBe(
      'AI 请求执行以下工具，请确认：',
    )
    // 预期值写死字面量（JSON.stringify(x, null, 2) 的手工结果），禁与实现同源计算
    expect(w.get('.ai-chat-tool-confirmation__args').text()).toBe(`{
  "path": "/tmp/x"
}`)
  })

  it('reason prop 覆盖默认说明', () => {
    const w = mountConfirmation({
      toolName: 'run_sql',
      reason: '该操作会写入生产库',
      status: 'awaiting-approval',
    })
    expect(w.get('.ai-chat-tool-confirmation__desc').text()).toBe(
      '该操作会写入生产库',
    )
  })

  it('点击"允许"触发 approve 且不触发 reject', async () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      status: 'awaiting-approval',
    })
    await w.get('.ai-chat-tool-confirmation__btn--approve').trigger('click')
    expect(w.emitted('approve')).toHaveLength(1)
    expect(w.emitted('reject')).toBeUndefined()
  })

  it('点击"拒绝"触发 reject 且不触发 approve', async () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      status: 'awaiting-approval',
    })
    await w.get('.ai-chat-tool-confirmation__btn--reject').trigger('click')
    expect(w.emitted('reject')).toHaveLength(1)
    expect(w.emitted('approve')).toBeUndefined()
  })

  it('渲染"允许/拒绝"按钮文案', () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      status: 'awaiting-approval',
    })
    expect(w.get('.ai-chat-tool-confirmation__btn--approve').text()).toBe(
      '允许',
    )
    expect(w.get('.ai-chat-tool-confirmation__btn--reject').text()).toBe('拒绝')
  })
})

describe('ToolConfirmation 已拒绝态', () => {
  it('隐藏按钮组并显示"已拒绝"状态', () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      status: 'denied',
    })
    expect(w.find('.ai-chat-tool-confirmation__actions').exists()).toBe(false)
    expect(w.get('.ai-chat-tool-confirmation__denied').text()).toBe('已拒绝')
    expect(w.classes()).toContain('ai-chat-tool-confirmation--denied')
  })

  it('denied 态仍展示工具名与参数（只读回溯）', () => {
    const w = mountConfirmation({
      toolName: 'delete_file',
      arguments: { path: '/tmp/x' },
      status: 'denied',
    })
    expect(w.get('.ai-chat-tool-confirmation__tool-name').text()).toBe(
      'delete_file',
    )
    expect(w.get('.ai-chat-tool-confirmation__args').exists()).toBe(true)
  })
})

describe('ToolConfirmation 边界与多语言', () => {
  it('边界：arguments 缺省时不渲染参数区', () => {
    const w = mountConfirmation({
      toolName: 'ping',
      status: 'awaiting-approval',
    })
    expect(w.find('.ai-chat-tool-confirmation__args').exists()).toBe(false)
  })

  it('边界：空参数对象显示 "{}"', () => {
    const w = mountConfirmation({
      toolName: 'ping',
      arguments: {},
      status: 'awaiting-approval',
    })
    expect(w.get('.ai-chat-tool-confirmation__args').text()).toBe('{}')
  })

  it('en-US 下标题与按钮为英文', () => {
    setAiChatLocale('en-US', { persist: false })
    const w = mountConfirmation({
      toolName: 'delete_file',
      status: 'awaiting-approval',
    })
    expect(w.get('.ai-chat-tool-confirmation__title').text()).toBe(
      'Confirmation required',
    )
    expect(w.get('.ai-chat-tool-confirmation__btn--approve').text()).toBe(
      'Allow',
    )
    expect(w.get('.ai-chat-tool-confirmation__btn--reject').text()).toBe('Deny')
  })
})
