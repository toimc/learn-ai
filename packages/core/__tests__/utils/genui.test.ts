import { describe, it, expect } from 'vitest'
import { isUISchema } from '../../src/utils/genui'

// 契约：对象（非 null 非数组）+ type 为非空字符串 + props 为非 null 非数组的对象

describe('isUISchema 合法判定', () => {
  it('正常：type + 带数据 props 的对象合法', () => {
    expect(
      isUISchema({ type: 'weather-card', props: { city: 'Beijing' } }),
    ).toBe(true)
  })

  it('边界：props 为空对象也合法', () => {
    expect(isUISchema({ type: 'weather-card', props: {} })).toBe(true)
  })
})

describe('isUISchema 非法判定：非对象形态', () => {
  const nonObjects: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['数字', 42],
    ['字符串', 'weather-card'],
    ['布尔', true],
    ['数组（元素本身像 schema）', [{ type: 'weather-card', props: {} }]],
  ]

  it.each(nonObjects)('值形态为 %s 返回 false', (_name, value) => {
    expect(isUISchema(value)).toBe(false)
  })
})

describe('isUISchema 非法判定：字段缺失/形态不符', () => {
  const invalidFields: Array<[string, unknown]> = [
    ['type 缺失', { props: { city: 'Beijing' } }],
    ['type 为空串', { type: '', props: {} }],
    ['type 为数字', { type: 123, props: {} }],
    ['type 为数组', { type: ['weather-card'], props: {} }],
    ['props 缺失', { type: 'weather-card' }],
    ['props 为 null', { type: 'weather-card', props: null }],
    ['props 为数组', { type: 'weather-card', props: [{ city: 'Beijing' }] }],
    ['props 为字符串', { type: 'weather-card', props: 'city=Beijing' }],
    ['props 为数字', { type: 'weather-card', props: 0 }],
  ]

  it.each(invalidFields)('%s 返回 false', (_name, value) => {
    expect(isUISchema(value)).toBe(false)
  })
})
