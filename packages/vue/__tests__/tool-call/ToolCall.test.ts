import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ToolCallInfo } from '@toimc/core'
import ToolCall from '../../src/tool-call/ToolCall.vue'
import ToolCallHeader from '../../src/tool-call/ToolCallHeader.vue'
import ToolCallContent from '../../src/tool-call/ToolCallContent.vue'
import ToolCallInput from '../../src/tool-call/ToolCallInput.vue'
import ToolCallOutput from '../../src/tool-call/ToolCallOutput.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: 'call_1',
    name: 'get_weather',
    arguments: { city: 'Beijing' },
    status: 'completed',
    result: { temp: 22 },
    ...overrides,
  }
}

/** Header/Input/Output 依赖 inject 的 toolCallData，直接 provide 挂载 */
function mountInsideShell(
  component: typeof ToolCallHeader,
  data: ToolCallInfo,
) {
  return mount(component, {
    global: { provide: { toolCallData: data } },
  })
}

describe('ToolCall 外壳（details 折叠面板）', () => {
  it('默认收起，渲染 summary 与 body 骨架', () => {
    const w = mount(ToolCall, { props: { data: makeToolCall() } })
    expect(w.get('details').attributes('open')).toBeUndefined()
    expect(w.find('.ai-chat-tool-call__summary').exists()).toBe(true)
    expect(w.find('.ai-chat-tool-call__body').exists()).toBe(true)
  })

  it('toggle 事件同步 isOpen：details 展开后 open 属性存在', async () => {
    const w = mount(ToolCall, { props: { data: makeToolCall() } })
    const details = w.get('details')
    details.element.open = true
    await details.trigger('toggle')
    expect(details.attributes('open')).toBeDefined()
    // 再次 toggle 收起
    details.element.open = false
    await details.trigger('toggle')
    expect(details.attributes('open')).toBeUndefined()
  })

  it('header 作用域 slot 接收 data 与 open 状态', () => {
    const w = mount(ToolCall, {
      props: { data: makeToolCall() },
      slots: {
        header: `<template #header="{ data, open }">
          <span class="custom-header">{{ data.name }}-{{ open }}</span>
        </template>`,
      },
    })
    expect(w.get('.custom-header').text()).toBe('get_weather-false')
  })

  it('default 作用域 slot 接收 data', () => {
    const w = mount(ToolCall, {
      props: { data: makeToolCall() },
      slots: {
        default: `<template #default="{ data }">
          <span class="custom-body">{{ data.id }}</span>
        </template>`,
      },
    })
    expect(w.get('.custom-body').text()).toBe('call_1')
  })
})

describe('ToolCallHeader 状态呈现', () => {
  it.each([
    ['calling', '⚡', 'ai-chat-tool-call-header--calling'],
    ['completed', '✓', 'ai-chat-tool-call-header--completed'],
    ['error', '✗', 'ai-chat-tool-call-header--error'],
  ] as const)('status=%s 渲染 %s 图标与对应类名', (status, icon, cls) => {
    const w = mountInsideShell(ToolCallHeader, makeToolCall({ status }))
    expect(w.get('.ai-chat-tool-call-header__icon').text()).toBe(icon)
    expect(w.get('.ai-chat-tool-call-header').classes()).toContain(cls)
  })

  it('正常：渲染工具名与耗时', () => {
    const w = mountInsideShell(
      ToolCallHeader,
      makeToolCall({ name: 'search', duration: 1500 }),
    )
    expect(w.get('.ai-chat-tool-call-header__name').text()).toBe('search')
    expect(w.get('.ai-chat-tool-call-header__duration').text()).toBe('1.5s')
  })

  it('边界：无 duration 时不渲染耗时节点', () => {
    const w = mountInsideShell(ToolCallHeader, makeToolCall())
    expect(w.find('.ai-chat-tool-call-header__duration').exists()).toBe(false)
  })
})

describe('ToolCallContent 条件渲染', () => {
  it('calling 阶段（无 result 无 error）只渲染参数区', () => {
    const w = mountInsideShell(
      ToolCallContent,
      makeToolCall({ status: 'calling', result: undefined }),
    )
    expect(w.find('.ai-chat-tool-call-input').exists()).toBe(true)
    expect(w.find('.ai-chat-tool-call-output').exists()).toBe(false)
  })

  it('有 result 时渲染结果区', () => {
    const w = mountInsideShell(ToolCallContent, makeToolCall())
    expect(w.find('.ai-chat-tool-call-output').exists()).toBe(true)
  })

  it('有 error 无 result 时也渲染结果区（错误态）', () => {
    const w = mountInsideShell(
      ToolCallContent,
      makeToolCall({ status: 'error', result: undefined, error: 'timeout' }),
    )
    expect(w.find('.ai-chat-tool-call-output').exists()).toBe(true)
  })
})

describe('ToolCallInput 参数展示', () => {
  it('正常：label 与 JSON 格式化参数', () => {
    const w = mountInsideShell(ToolCallInput, makeToolCall())
    expect(w.get('.ai-chat-tool-call-input__label').text()).toBe('参数')
    // 预期值写死字面量，禁止用与实现相同的 JSON.stringify 表达式计算预期（同义反复断言）
    expect(w.get('.ai-chat-tool-call-input__code').text()).toBe(`{
  "city": "Beijing"
}`)
  })

  it('边界：空参数对象显示 "{}"', () => {
    const w = mountInsideShell(ToolCallInput, makeToolCall({ arguments: {} }))
    expect(w.get('.ai-chat-tool-call-input__code').text()).toBe('{}')
  })
})

describe('ToolCallOutput 结果/错误展示', () => {
  it('正常：label"结果"与 JSON 结果', () => {
    const w = mountInsideShell(ToolCallOutput, makeToolCall())
    expect(w.get('.ai-chat-tool-call-output__label').text()).toBe('结果')
    // 同上：预期值独立于实现写死，格式化参数变化（如缩进改成 4）时本断言应失败
    expect(w.get('.ai-chat-tool-call-output__code').text()).toBe(`{
  "temp": 22
}`)
  })

  it('异常：error 优先于 result 展示，label 为"错误"', () => {
    const w = mountInsideShell(
      ToolCallOutput,
      makeToolCall({ error: 'boom', result: { stale: true } }),
    )
    expect(w.get('.ai-chat-tool-call-output__label').text()).toBe('错误')
    expect(w.get('.ai-chat-tool-call-output__code').text()).toBe('boom')
    expect(w.get('.ai-chat-tool-call-output__code').classes()).toContain(
      'ai-chat-tool-call-output__code--error',
    )
  })

  it('边界：result 为 null（显式空结果）仍渲染结果区', () => {
    const w = mountInsideShell(ToolCallOutput, makeToolCall({ result: null }))
    expect(w.get('.ai-chat-tool-call-output__label').text()).toBe('结果')
  })
})
