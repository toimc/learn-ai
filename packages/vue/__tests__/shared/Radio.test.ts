import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Radio from '../../src/shared/Radio.vue'

describe('Radio 渲染与选中态', () => {
  it('正常：渲染隐藏原生 input（type=radio）+ 自绘圆环 + label 文本', () => {
    const w = mount(Radio, {
      props: { value: 'openai-compat', label: 'OpenAI 兼容' },
    })
    const input = w.get('input')
    expect(input.attributes('type')).toBe('radio')
    expect(input.attributes('value')).toBe('openai-compat')
    expect(w.find('.ai-chat-radio__circle').exists()).toBe(true)
    expect(w.get('.ai-chat-radio__label').text()).toBe('OpenAI 兼容')
  })

  it('正常：modelValue 等于 value 时选中并带 --checked 类', () => {
    const w = mount(Radio, {
      props: { modelValue: 'openai-compat', value: 'openai-compat' },
    })
    expect((w.get('input').element as HTMLInputElement).checked).toBe(true)
    expect(w.classes()).toContain('ai-chat-radio--checked')
  })

  it('正常：modelValue 不等于 value 时未选中、无 --checked 类', () => {
    const w = mount(Radio, {
      props: { modelValue: 'anthropic', value: 'openai-compat' },
    })
    expect((w.get('input').element as HTMLInputElement).checked).toBe(false)
    expect(w.classes()).not.toContain('ai-chat-radio--checked')
  })

  it('正常：change 后 emit 自身 value 的字面量载荷', async () => {
    const w = mount(Radio, {
      props: { modelValue: '', value: 'anthropic' },
    })
    await w.get('input').trigger('change')
    expect(w.emitted('update:modelValue')).toEqual([['anthropic']])
  })

  it('正常：name prop 透传到原生 input 用于宿主分组', () => {
    const w = mount(Radio, {
      props: { value: 'a', name: 'provider-type' },
    })
    expect(w.get('input').attributes('name')).toBe('provider-type')
  })

  it('边界：不传 label 时不渲染 label 文本节点', () => {
    const w = mount(Radio, { props: { value: 'a' } })
    expect(w.find('.ai-chat-radio__label').exists()).toBe(false)
  })

  it('边界：disabled 渲染禁用属性，程序化 change 不 emit', async () => {
    const w = mount(Radio, {
      props: { value: 'a', disabled: true },
    })
    expect(w.get('input').attributes('disabled')).toBeDefined()
    await w.get('input').trigger('change')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('异常：再点已选项（modelValue 已等于 value）不重复 emit', async () => {
    const w = mount(Radio, {
      props: { modelValue: 'a', value: 'a' },
    })
    await w.get('input').trigger('change')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
