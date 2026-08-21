import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Shimmer from './Shimmer.vue'

describe('Shimmer 骨架屏占位', () => {
  it('默认：渲染 span，duration 2000ms', () => {
    const w = mount(Shimmer)
    expect(w.element.tagName).toBe('SPAN')
    expect(w.attributes('style')).toContain('animation-duration: 2000ms')
  })

  it('正常：as 指定渲染标签', () => {
    const w = mount(Shimmer, { props: { as: 'div' } })
    expect(w.element.tagName).toBe('DIV')
  })

  it('正常：自定义 duration 写入 animation-duration', () => {
    const w = mount(Shimmer, { props: { duration: 3500 } })
    expect(w.attributes('style')).toContain('animation-duration: 3500ms')
  })

  it('正常：slot 内容透传', () => {
    const w = mount(Shimmer, { slots: { default: '加载中' } })
    expect(w.text()).toBe('加载中')
  })
})
