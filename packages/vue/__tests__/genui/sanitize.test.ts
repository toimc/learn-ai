import { describe, it, expect } from 'vitest'
import { sanitizeGenuiProps } from '../../src/genui/sanitize'

// 契约（文档表格）：逐值递归消毒，纯函数不修改入参
// 键丢弃断言用 Object.keys 而非 toEqual——toEqual 会把 { a: undefined } 与 {} 视为相等，抓不住"保留了个 undefined 键"的错误

describe('sanitizeGenuiProps 注入面与非有限值丢弃', () => {
  it('function / undefined / symbol 的键被丢弃，其余保留', () => {
    const sym = Symbol('token')
    const result = sanitizeGenuiProps({
      onClick: () => 1,
      maybe: undefined,
      token: sym,
      keep: 'ok',
    })
    expect(Object.keys(result).sort()).toEqual(['keep'])
    expect(result.keep).toBe('ok')
  })

  it('NaN / Infinity / -Infinity 的键被丢弃', () => {
    const result = sanitizeGenuiProps({
      a: NaN,
      b: Infinity,
      c: -Infinity,
      ok: 22,
    })
    expect(Object.keys(result).sort()).toEqual(['ok'])
    expect(result.ok).toBe(22)
  })

  it('Date / Map / Set 实例的键被丢弃（消毒域外）', () => {
    const result = sanitizeGenuiProps({
      at: new Date(0),
      bag: new Map(),
      set: new Set(),
      keep: 1,
    })
    expect(Object.keys(result).sort()).toEqual(['keep'])
  })
})

describe('sanitizeGenuiProps 基础值保留', () => {
  it('有限 number / boolean / null 原样保留', () => {
    const result = sanitizeGenuiProps({
      n: 22,
      neg: -3.5,
      zero: 0,
      t: true,
      f: false,
      z: null,
    })
    expect(result).toStrictEqual({
      n: 22,
      neg: -3.5,
      zero: 0,
      t: true,
      f: false,
      z: null,
    })
  })

  it('边界：空对象返回空对象', () => {
    expect(sanitizeGenuiProps({})).toStrictEqual({})
  })
})

describe('sanitizeGenuiProps URL 协议白名单', () => {
  it.each([
    ['https 字符串', 'https://a.com/x', 'https://a.com/x'],
    ['http 字符串', 'http://a.com', 'http://a.com'],
    ['blob 字符串', 'blob:550e8400-e29b', 'blob:550e8400-e29b'],
    ['大写 HTTPS（大小写不敏感）', 'HTTPS://A.COM', 'HTTPS://A.COM'],
    ['首字母大写 Blob:', 'Blob:abc123', 'Blob:abc123'],
  ] as const)('%s 原样保留', (_name, input, expected) => {
    expect(sanitizeGenuiProps({ link: input })).toStrictEqual({
      link: expected,
    })
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['大写 JavaScript:（大小写不敏感）', 'JavaScript:alert(1)'],
    [
      'data:image（GenUI 白名单不含，从严于附件校验）',
      'data:image/png;base64,xx',
    ],
    ['mailto:', 'mailto:a@b.c'],
  ] as const)('%s 整键丢弃', (_name, input) => {
    const result = sanitizeGenuiProps({ link: input, keep: 1 })
    expect(Object.keys(result)).toEqual(['keep'])
  })
})

describe('sanitizeGenuiProps 字符串处理', () => {
  it.each([
    ['22', 22],
    ['-3.5', -3.5],
    ['007', 7],
    ['0', 0],
  ] as const)('纯数字字符串 %s 收窄为 number %s', (input, expected) => {
    const result = sanitizeGenuiProps({ v: input })
    expect(result).toStrictEqual({ v: expected })
  })

  it.each(['Sunny', '1e3', '', 'v1.2', '22 '])(
    '普通字符串 %s 原样保留字符串形态',
    (input) => {
      const result = sanitizeGenuiProps({ v: input })
      expect(result).toStrictEqual({ v: input })
    },
  )
})

describe('sanitizeGenuiProps 递归结构', () => {
  it('数组逐元素消毒，被丢弃元素剔除', () => {
    const result = sanitizeGenuiProps({ list: [1, () => 1, 'a', NaN] })
    expect(result).toStrictEqual({ list: [1, 'a'] })
  })

  it('数组内元素按同一规则递归（URL 剔除、数字字符串收窄）', () => {
    const result = sanitizeGenuiProps({
      list: ['https://a.com', 'javascript:x', '22'],
    })
    expect(result).toStrictEqual({ list: ['https://a.com', 22] })
  })

  it('嵌套 plain object 逐键递归同规则（危险值同样被清）', () => {
    const result = sanitizeGenuiProps({
      outer: {
        fn: () => 1,
        link: 'javascript:alert(1)',
        num: '22',
        keep: 'x',
        inner: { deep: 'Sunny', bad: NaN },
      },
      top: 1,
    })
    expect(result).toStrictEqual({
      outer: { num: 22, keep: 'x', inner: { deep: 'Sunny' } },
      top: 1,
    })
  })
})

describe('sanitizeGenuiProps 纯函数语义', () => {
  it('不修改入参（浅层与嵌套对象均保持原样）', () => {
    const nested = Object.freeze({ a: 1, bad: () => 2 })
    const input = Object.freeze({ n: '22', js: 'javascript:alert(1)', nested })
    const result = sanitizeGenuiProps(input)
    // 入参逐字段与调用前一致；冻结对象若被就地写会直接抛 TypeError
    expect(input).toStrictEqual({ n: '22', js: 'javascript:alert(1)', nested })
    expect(result).toStrictEqual({ n: 22, nested: { a: 1 } })
  })
})
