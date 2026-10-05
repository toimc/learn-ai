/**
 * 双盲测试：BranchPicker
 * 契约来源：packages/docs/components/branch-picker.md（未读实现源码）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BranchPicker, setAiChatLocale } from '@toimc/vue'

const mounted: VueWrapper[] = []

function mountPicker(
  props: { branchCount: number; activeBranch: number; showLabel?: boolean },
  slotText = 'BRANCH CONTENT',
) {
  const w = mount(BranchPicker, {
    props,
    slots: { default: slotText },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

function navButtons(w: VueWrapper) {
  const btns = w.findAll('button')
  expect(btns).toHaveLength(2)
  return btns
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('BranchPicker（契约：docs/components/branch-picker.md）', () => {
  it('branchCount<=1 时组件整体不渲染（null）', () => {
    const one = mountPicker({ branchCount: 1, activeBranch: 0 })
    expect(one.html()).toBe('<!---->')
    const zero = mountPicker({ branchCount: 0, activeBranch: 0 })
    expect(zero.html()).toBe('<!---->')
  })

  it('3 分支 active=0：标签 1/3，首分支恰一颗方向按钮禁用', () => {
    const w = mountPicker({ branchCount: 3, activeBranch: 0 })
    expect(w.text()).toMatch(/1\s*\/\s*3/)
    const disabled = navButtons(w).filter(
      (b) => b.attributes('disabled') !== undefined,
    )
    expect(disabled).toHaveLength(1)
  })

  it('首分支点可用方向按钮 → change 上抛相邻索引 1', async () => {
    const w = mountPicker({ branchCount: 3, activeBranch: 0 })
    const enabled = navButtons(w).find(
      (b) => b.attributes('disabled') === undefined,
    )
    if (!enabled) throw new Error('首分支应有一颗可用方向按钮')
    await enabled.trigger('click')
    expect(w.emitted('change')).toEqual([[1]])
  })

  it('首分支点禁用按钮不触发 change（disabled + 不 emit）', async () => {
    const w = mountPicker({ branchCount: 3, activeBranch: 0 })
    const disabled = navButtons(w).find(
      (b) => b.attributes('disabled') !== undefined,
    )
    if (!disabled) throw new Error('首分支应有一颗禁用方向按钮')
    await disabled.trigger('click')
    expect(w.emitted('change')).toBeUndefined()
  })

  it('末分支（active=2）：另一侧禁用，点可用方向 → change(1)', async () => {
    const w = mountPicker({ branchCount: 3, activeBranch: 2 })
    expect(w.text()).toMatch(/3\s*\/\s*3/)
    const disabled = navButtons(w).filter(
      (b) => b.attributes('disabled') !== undefined,
    )
    expect(disabled).toHaveLength(1)
    const enabled = navButtons(w).find(
      (b) => b.attributes('disabled') === undefined,
    )
    if (!enabled) throw new Error('末分支应有一颗可用方向按钮')
    await enabled.trigger('click')
    expect(w.emitted('change')).toEqual([[1]])
  })

  it('activeBranch 越界钳制：99 → 3/3；-5 → 1/3（不出现越界标签）', () => {
    const over = mountPicker({ branchCount: 3, activeBranch: 99 })
    expect(over.text()).toMatch(/3\s*\/\s*3/)
    expect(over.text()).not.toMatch(/100\s*\/\s*3/)
    const under = mountPicker({ branchCount: 3, activeBranch: -5 })
    expect(under.text()).toMatch(/1\s*\/\s*3/)
  })

  it('showLabel=false 不显示版本标签；default 插槽渲染当前分支内容', () => {
    const w = mountPicker({ branchCount: 3, activeBranch: 1, showLabel: false })
    expect(w.text()).not.toMatch(/\d\s*\/\s*\d/)
    expect(w.text()).toContain('BRANCH CONTENT')
  })
})
