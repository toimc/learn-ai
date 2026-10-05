import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ToolCallInfo, ToolCallStatus } from '@toimc/core'
import ToolCallHeader from '../../src/tool-call/ToolCallHeader.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: 'call_1',
    name: 'get_weather',
    arguments: { city: 'Beijing' },
    status: 'completed',
    ...overrides,
  }
}

/** Header 依赖 inject 的 toolCallData，直接 provide 挂载 */
function mountHeader(data: ToolCallInfo) {
  return mount(ToolCallHeader, {
    global: { provide: { toolCallData: data } },
  })
}

describe('ToolCallHeader 六态徽章', () => {
  it.each([
    ['pending', '⏳', '准备中'],
    ['calling', '⚡', '运行中'],
    ['awaiting-approval', '⛨', '等待确认'],
    ['completed', '✓', '已完成'],
    ['denied', '⊘', '已拒绝'],
    ['error', '✗', '失败'],
  ] as const)('status=%s 渲染图标 %s 与标签"%s"', (status, icon, label) => {
    const w = mountHeader(makeToolCall({ status: status as ToolCallStatus }))
    expect(w.get('.ai-chat-tool-call-header__icon').text()).toBe(icon)
    expect(w.get('.ai-chat-tool-call-header__status').text()).toBe(label)
    expect(w.get('.ai-chat-tool-call-header').classes()).toContain(
      `ai-chat-tool-call-header--${status}`,
    )
  })

  it('en-US 下状态标签切换为英文', () => {
    setAiChatLocale('en-US', { persist: false })
    const w = mountHeader(makeToolCall({ status: 'awaiting-approval' }))
    expect(w.get('.ai-chat-tool-call-header__status').text()).toBe(
      'Awaiting approval',
    )
  })

  it('标签与图标之外仍渲染工具名（六态徽章不回归基础信息）', () => {
    const w = mountHeader(makeToolCall({ name: 'search_docs' }))
    expect(w.get('.ai-chat-tool-call-header__name').text()).toBe('search_docs')
  })
})
