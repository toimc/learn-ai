import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanActions from '../../src/genui/PlanActions.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

const plans = [
  { id: 'plan-1', title: '重构核心层', summary: '抽出 useChat 纯逻辑' },
  { id: 'plan-2', title: '升级样式系统', summary: '三层令牌结构落地' },
]

describe('PlanActions 列表渲染', () => {
  it('每个 plan 渲染一行（ai-chat-plan-actions__item），显示 title 与 summary', () => {
    const w = mount(PlanActions, { props: { plans } })
    const items = w.findAll('.ai-chat-plan-actions__item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('重构核心层')
    expect(items[0].text()).toContain('抽出 useChat 纯逻辑')
    expect(items[1].text()).toContain('升级样式系统')
    expect(items[1].text()).toContain('三层令牌结构落地')
  })

  it('每行一个采纳按钮，zh-CN 文案为「采纳」', () => {
    const w = mount(PlanActions, { props: { plans } })
    const buttons = w.findAll('.ai-chat-plan-actions__adopt')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('采纳')
    expect(buttons[1].text()).toBe('采纳')
  })

  it('边界：空数组渲染容器但无行、无采纳按钮', () => {
    const w = mount(PlanActions, { props: { plans: [] } })
    expect(w.find('.ai-chat-plan-actions').exists()).toBe(true)
    expect(w.findAll('.ai-chat-plan-actions__item')).toHaveLength(0)
    expect(w.findAll('.ai-chat-plan-actions__adopt')).toHaveLength(0)
  })
})

describe('PlanActions adopt 事件', () => {
  it('点击第一行采纳按钮触发 adopt，参数为该行 plan.id', async () => {
    const w = mount(PlanActions, { props: { plans } })
    await w.findAll('.ai-chat-plan-actions__adopt')[0].trigger('click')
    expect(w.emitted('adopt')).toEqual([['plan-1']])
  })

  it('点击第二行采纳按钮参数为 plan-2', async () => {
    const w = mount(PlanActions, { props: { plans } })
    await w.findAll('.ai-chat-plan-actions__adopt')[1].trigger('click')
    expect(w.emitted('adopt')).toEqual([['plan-2']])
  })
})
