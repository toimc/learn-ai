import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Input from '../../src/shared/Input.vue'

describe('Input 渲染与 v-model', () => {
  it('正常：默认渲染 text 输入框，带 ai-chat-input 与 --md 修饰类', () => {
    const w = mount(Input)
    expect(w.get('input').attributes('type')).toBe('text')
    expect(w.classes()).toContain('ai-chat-input')
    expect(w.classes()).toContain('ai-chat-input--md')
  })

  it('正常：type=password 渲染密码输入框', () => {
    const w = mount(Input, { props: { type: 'password' } })
    expect(w.get('input').attributes('type')).toBe('password')
  })

  it('正常：placeholder 与 autocomplete 透传到原生属性', () => {
    const w = mount(Input, {
      props: { placeholder: '请输入名称', autocomplete: 'new-password' },
    })
    expect(w.attributes('placeholder')).toBe('请输入名称')
    expect(w.attributes('autocomplete')).toBe('new-password')
  })

  it('正常：modelValue 写入元素值，输入后 emit 字面量载荷', async () => {
    const w = mount(Input, { props: { modelValue: 'a' } })
    expect(w.get('input').element.value).toBe('a')
    await w.get('input').setValue('hello')
    expect(w.emitted('update:modelValue')).toEqual([['hello']])
  })

  it('正常：外部 setProps 更新 modelValue 反映到元素值（双向）', async () => {
    const w = mount(Input, { props: { modelValue: 'a' } })
    await w.setProps({ modelValue: 'b' })
    expect(w.get('input').element.value).toBe('b')
  })

  it('正常：blur 事件透传', async () => {
    const w = mount(Input)
    await w.get('input').trigger('blur')
    expect(w.emitted('blur')).toHaveLength(1)
  })

  it('边界：size=sm 渲染 --sm 修饰类且不含 --md', () => {
    const w = mount(Input, { props: { size: 'sm' } })
    expect(w.classes()).toContain('ai-chat-input--sm')
    expect(w.classes()).not.toContain('ai-chat-input--md')
  })

  it('边界：invalid 渲染 --invalid 类与 aria-invalid="true"', () => {
    const w = mount(Input, { props: { invalid: true } })
    expect(w.classes()).toContain('ai-chat-input--invalid')
    expect(w.attributes('aria-invalid')).toBe('true')
  })

  it('边界：默认不渲染 aria-invalid 属性', () => {
    const w = mount(Input)
    expect(w.attributes('aria-invalid')).toBeUndefined()
  })

  it('边界：disabled 渲染禁用属性，程序化输入不 emit update:modelValue', async () => {
    const w = mount(Input, { props: { disabled: true } })
    expect(w.attributes('disabled')).toBeDefined()
    await w.get('input').setValue('x')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
