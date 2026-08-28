import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Select from '../../src/shared/Select.vue'

const SLOT_OPTIONS =
  '<option value="a">选项A</option><option value="b">选项B</option>'

describe('Select 渲染与 v-model', () => {
  it('正常：渲染原生 select 与默认插槽 option', () => {
    const w = mount(Select, {
      props: { modelValue: 'a' },
      slots: { default: SLOT_OPTIONS },
    })
    expect(w.classes()).toContain('ai-chat-select')
    expect(w.classes()).toContain('ai-chat-select--md')
    expect(w.findAll('option')).toHaveLength(2)
    expect(w.findAll('option')[0].text()).toBe('选项A')
  })

  it('正常：modelValue 选中对应 option，切换后 emit 字面量载荷', async () => {
    const w = mount(Select, {
      props: { modelValue: 'a' },
      slots: { default: SLOT_OPTIONS },
    })
    expect(w.get('select').element.value).toBe('a')
    await w.get('select').setValue('b')
    expect(w.emitted('update:modelValue')).toEqual([['b']])
  })

  it('正常：外部 setProps 更新 modelValue 反映到选中值（双向）', async () => {
    const w = mount(Select, {
      props: { modelValue: 'a' },
      slots: { default: SLOT_OPTIONS },
    })
    await w.setProps({ modelValue: 'b' })
    expect(w.get('select').element.value).toBe('b')
  })

  it('正常：渲染自绘 chevron 图标且对读屏隐藏', () => {
    const w = mount(Select, { slots: { default: SLOT_OPTIONS } })
    const chevron = w.get('.ai-chat-select__chevron')
    expect(chevron.attributes('aria-hidden')).toBe('true')
  })

  it('边界：size=sm 渲染 --sm 修饰类', () => {
    const w = mount(Select, {
      props: { size: 'sm' },
      slots: { default: SLOT_OPTIONS },
    })
    expect(w.classes()).toContain('ai-chat-select--sm')
  })

  it('边界：invalid 渲染 --invalid 类与 select 上的 aria-invalid="true"', () => {
    const w = mount(Select, {
      props: { invalid: true },
      slots: { default: SLOT_OPTIONS },
    })
    expect(w.classes()).toContain('ai-chat-select--invalid')
    expect(w.get('select').attributes('aria-invalid')).toBe('true')
  })

  it('边界：disabled 渲染禁用属性，程序化切换不 emit update:modelValue', async () => {
    const w = mount(Select, {
      props: { disabled: true },
      slots: { default: SLOT_OPTIONS },
    })
    expect(w.get('select').attributes('disabled')).toBeDefined()
    await w.get('select').setValue('b')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('异常：空插槽（无 options）渲染不崩，select 存在且无 option', () => {
    const w = mount(Select)
    expect(w.find('select').exists()).toBe(true)
    expect(w.findAll('option')).toHaveLength(0)
  })
})
