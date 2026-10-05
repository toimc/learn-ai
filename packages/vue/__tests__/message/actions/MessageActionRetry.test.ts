import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageActionRetry from '../../../src/message/actions/MessageActionRetry.vue'
import { setAiChatLocale } from '../../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('MessageActionRetry 重试操作', () => {
  it('正常：渲染动作按钮，title 默认取字典 messageActions.retry', () => {
    const w = mount(MessageActionRetry)
    expect(w.get('button').attributes('title')).toBe('重新生成')
  })

  it('正常：点击 emit retry', async () => {
    const w = mount(MessageActionRetry)
    await w.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('正常：连续点击逐次 emit', async () => {
    const w = mount(MessageActionRetry)
    await w.trigger('click')
    await w.trigger('click')
    expect(w.emitted('retry')).toHaveLength(2)
  })

  it('异常：disabled 时按钮禁用且不 emit', async () => {
    const w = mount(MessageActionRetry, { props: { disabled: true } })
    expect(w.get('button').attributes('disabled')).toBeDefined()
    await w.trigger('click')
    expect(w.emitted('retry')).toBeUndefined()
  })
})
