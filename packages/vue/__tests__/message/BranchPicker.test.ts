import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BranchPicker from '../../src/message/BranchPicker.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

const root = '.ai-chat-branch-picker'
const prev = '.ai-chat-branch-picker__btn--prev'
const next = '.ai-chat-branch-picker__btn--next'
const label = '.ai-chat-branch-picker__label'

describe('BranchPicker 消息分支翻页', () => {
  it('边界：branchCount<=1 时整体不渲染', () => {
    const one = mount(BranchPicker, {
      props: { branchCount: 1, activeBranch: 0 },
    })
    expect(one.find(root).exists()).toBe(false)
    const zero = mount(BranchPicker, {
      props: { branchCount: 0, activeBranch: 0 },
    })
    expect(zero.find(root).exists()).toBe(false)
  })

  it('正常：渲染翻页按钮与标签，文案来自字典插值', () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 3, activeBranch: 0 },
    })
    expect(w.get(prev).attributes('aria-label')).toBe('上一个版本')
    expect(w.get(next).attributes('aria-label')).toBe('下一个版本')
    expect(w.get(label).text()).toBe('版本 1/3')
  })

  it('正常：activeBranch 驱动标签与禁用态', () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 3, activeBranch: 1 },
    })
    expect(w.get(label).text()).toBe('版本 2/3')
    expect(w.get(prev).attributes('disabled')).toBeUndefined()
    expect(w.get(next).attributes('disabled')).toBeUndefined()
  })

  it('正常：点击 next/prev 分别 emit 目标索引', async () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 3, activeBranch: 1 },
    })
    await w.get(next).trigger('click')
    await w.get(prev).trigger('click')
    expect(w.emitted('change')).toEqual([[2], [0]])
  })

  it('边界：首分支 prev 禁用且不 emit', async () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 2, activeBranch: 0 },
    })
    expect(w.get(prev).attributes('disabled')).toBeDefined()
    await w.get(prev).trigger('click')
    expect(w.emitted('change')).toBeUndefined()
  })

  it('边界：末分支 next 禁用且不 emit', async () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 2, activeBranch: 1 },
    })
    expect(w.get(next).attributes('disabled')).toBeDefined()
    await w.get(next).trigger('click')
    expect(w.emitted('change')).toBeUndefined()
  })

  it('边界：showLabel=false 不渲染标签', () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 3, activeBranch: 0, showLabel: false },
    })
    expect(w.find(label).exists()).toBe(false)
  })

  it('正常：default 插槽渲染当前分支内容', () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 2, activeBranch: 0 },
      slots: { default: '<p class="branch-body">分支 0 的内容</p>' },
    })
    expect(w.get('.ai-chat-branch-picker__content .branch-body').text()).toBe(
      '分支 0 的内容',
    )
  })

  it('边界：activeBranch 越界时标签钳制、翻页按钳制值计算', async () => {
    const w = mount(BranchPicker, {
      props: { branchCount: 3, activeBranch: 5 },
    })
    expect(w.get(label).text()).toBe('版本 3/3')
    expect(w.get(next).attributes('disabled')).toBeDefined()
    await w.get(prev).trigger('click')
    expect(w.emitted('change')).toEqual([[1]])
  })
})
