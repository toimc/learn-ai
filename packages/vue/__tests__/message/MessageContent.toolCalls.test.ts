import { describe, expect, it, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import MessageContent from '../../src/message/MessageContent.vue'
import {
  registerGenuiComponent,
  unregisterGenuiComponent,
} from '../../src/genui'
import type { ToolCallInfo } from '@toimc/core'

const TEST_TYPE = 'mc-toolcalls-test-card'

/** 独立测试组件：渲染固定文本，证明 schema → 注册表 → 组件整条链路 */
const TestCard = defineComponent({
  props: { label: { type: String, default: '' } },
  setup(props) {
    return () => h('div', { class: 'test-card' }, `card:${props.label}`)
  },
})

function completedToolCall(result: unknown): ToolCallInfo {
  return {
    id: 'call_1',
    name: 'get_weather',
    arguments: { city: 'Beijing' },
    status: 'completed',
    result,
  }
}

describe('MessageContent toolCalls 渲染区（opt-in）', () => {
  afterEach(() => {
    unregisterGenuiComponent(TEST_TYPE)
  })

  it('completed 且 result.ui 为合法 schema 且 type 已注册时渲染 GenUI 卡片', () => {
    registerGenuiComponent(TEST_TYPE, TestCard)
    const tc = completedToolCall({
      city: 'Beijing',
      ui: { type: TEST_TYPE, props: { label: 'beijing-day' } },
    })

    const w = mount(MessageContent, {
      props: { content: '已查询到天气', toolCalls: [tc] },
    })

    expect(w.get('.test-card').text()).toBe('card:beijing-day')
  })

  it('合法 schema 但 type 未注册时走 fallback 渲染 ToolCall 面板', () => {
    const tc = completedToolCall({
      city: 'Beijing',
      ui: { type: 'not-registered-type', props: { label: 'x' } },
    })

    const w = mount(MessageContent, {
      props: { content: '正文', toolCalls: [tc] },
    })

    // fallback 是 ToolCall 面板（details 折叠结构），不是降级提示 div
    expect(w.find('.ai-chat-tool-call').exists()).toBe(true)
    expect(w.find('.ai-chat-genui-fallback').exists()).toBe(false)
  })

  it('status 非 completed 时不走 GenUI，渲染 ToolCall 面板', () => {
    const tc: ToolCallInfo = {
      id: 'call_2',
      name: 'get_weather',
      arguments: { city: 'Beijing' },
      status: 'calling',
    }

    const w = mount(MessageContent, {
      props: { content: '查询中', toolCalls: [tc] },
    })

    expect(w.find('.ai-chat-tool-call').exists()).toBe(true)
    expect(w.find('.test-card').exists()).toBe(false)
  })

  it('result.ui 非法（数组）时渲染 ToolCall 面板', () => {
    const tc = completedToolCall({ ui: [{ type: TEST_TYPE, props: {} }] })

    const w = mount(MessageContent, {
      props: { content: '正文', toolCalls: [tc] },
    })

    expect(w.find('.ai-chat-tool-call').exists()).toBe(true)
  })

  it('不传 toolCalls 时不渲染工具调用区（现有行为不变）', () => {
    const w = mount(MessageContent, {
      props: { content: '纯文本消息' },
      slots: { default: () => h('p', '正文走 slot') },
    })

    expect(w.find('.ai-chat-message-content__tools').exists()).toBe(false)
    expect(w.find('.ai-chat-tool-call').exists()).toBe(false)
    // content prop 存在但无注入 renderer 时走默认 slot（现有行为）
    expect(w.text()).toContain('正文走 slot')
  })

  it('传空数组时不渲染工具调用区', () => {
    const w = mount(MessageContent, {
      props: { content: '纯文本消息', toolCalls: [] },
    })

    expect(w.find('.ai-chat-message-content__tools').exists()).toBe(false)
  })
})
