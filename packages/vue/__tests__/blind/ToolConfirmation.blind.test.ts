/**
 * 双盲测试：ToolConfirmation
 * 契约来源：packages/docs/components/tool-confirmation.md（未读实现源码）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { ToolConfirmation, setAiChatLocale } from '@toimc/vue'
import { domText } from './helpers'

const mounted: VueWrapper[] = []

interface ConfProps {
  toolName: string
  arguments?: Record<string, unknown>
  reason?: string
  status: 'awaiting-approval' | 'denied'
}

function mountConf(props: ConfProps) {
  const w = mount(ToolConfirmation, { props, attachTo: document.body })
  mounted.push(w)
  return w
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})

describe('ToolConfirmation（契约：docs/components/tool-confirmation.md）', () => {
  it('awaiting-approval：工具名、审批说明、参数 JSON 展示，恰两颗操作按钮', () => {
    setAiChatLocale('en-US')
    const w = mountConf({
      toolName: 'delete_file',
      arguments: { path: '/tmp/lock.db' },
      reason: 'Irreversible deletion',
      status: 'awaiting-approval',
    })
    const text = domText(w)
    expect(text).toContain('delete_file')
    expect(text).toContain('Irreversible deletion')
    expect(text).toContain('"path"')
    expect(text).toContain('/tmp/lock.db')
    expect(w.findAll('button')).toHaveLength(2)
  })

  it('两颗按钮分别触发 approve / reject（无参数事件）', async () => {
    const w = mountConf({
      toolName: 'delete_file',
      status: 'awaiting-approval',
    })
    const btns = w.findAll('button')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(w.emitted('approve')).toEqual([[]])
    expect(w.emitted('reject')).toEqual([[]])
  })

  it('denied：按钮组隐藏，工具名与参数保留，显示「已拒绝」', () => {
    setAiChatLocale('zh-CN')
    const w = mountConf({
      toolName: 'delete_file',
      arguments: { path: '/tmp/lock.db' },
      status: 'denied',
    })
    expect(w.findAll('button')).toHaveLength(0)
    const text = domText(w)
    expect(text).toContain('delete_file')
    expect(text).toContain('/tmp/lock.db')
    expect(text).toContain('已拒绝')
  })

  it('空对象参数显示 {}', () => {
    const w = mountConf({
      toolName: 'no_args_tool',
      arguments: {},
      status: 'awaiting-approval',
    })
    expect(domText(w)).toContain('{}')
  })

  it('arguments 缺省时不渲染参数区', () => {
    const w = mountConf({
      toolName: 'no_args_tool',
      status: 'awaiting-approval',
    })
    expect(domText(w)).not.toContain('{}')
  })

  it('循环引用入参兜底 String()：渲染 [object Object]，不抛渲染错误', () => {
    const cyc: Record<string, unknown> = {}
    cyc.self = cyc
    const w = mountConf({
      toolName: 'cyc_tool',
      arguments: cyc,
      status: 'awaiting-approval',
    })
    const text = domText(w)
    expect(text).toContain('cyc_tool')
    expect(text).toContain('[object Object]')
  })
})
