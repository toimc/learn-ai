import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '../../src/shared/Button.vue'

describe('Button 渲染', () => {
  it('默认：不传 type/size 时回退 primary + medium 修饰类', () => {
    const w = mount(Button, { slots: { default: '按钮' } })
    expect(w.classes()).toContain('ai-chat-btn--primary')
    expect(w.classes()).toContain('ai-chat-btn--medium')
    expect(w.get('button').text()).toBe('按钮')
  })

  it.each(['primary', 'secondary', 'danger'] as const)(
    'type=%s 渲染对应修饰类',
    (type) => {
      const w = mount(Button, { props: { type } })
      expect(w.classes()).toContain(`ai-chat-btn--${type}`)
    },
  )

  it('边界：默认原生 type=button（表单内点击不触发浏览器原生 submit 双发）', () => {
    const w = mount(Button)
    expect(w.get('button').attributes('type')).toBe('button')
  })

  it('nativeType=submit 时透传原生 type=submit（显式表单提交按钮语义）', () => {
    const w = mount(Button, { props: { nativeType: 'submit' } })
    expect(w.get('button').attributes('type')).toBe('submit')
  })

  it.each(['small', 'medium', 'large'] as const)(
    'size=%s 渲染对应修饰类',
    (size) => {
      const w = mount(Button, { props: { size } })
      expect(w.classes()).toContain(`ai-chat-btn--${size}`)
    },
  )

  it('正常：点击透传 click 事件', async () => {
    const w = mount(Button)
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('异常：disabled 时按钮禁用，点击不触发 click', async () => {
    const w = mount(Button, { props: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })
})
