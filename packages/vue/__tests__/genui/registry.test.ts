import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, type Component } from 'vue'
import {
  registerGenuiComponent,
  resolveGenuiComponent,
  unregisterGenuiComponent,
} from '../../src/genui/registry'

const Dummy = defineComponent({ template: '<div class="dummy" />' })
const Other = defineComponent({ template: '<span class="other" />' })

// 注册表是模块级单例：逐用例登记自己注册的 type，afterEach 清理防跨用例泄漏
const usedTypes: string[] = []
function register(type: string, component: Component = Dummy) {
  registerGenuiComponent(type, component)
  usedTypes.push(type)
}
afterEach(() => {
  for (const t of usedTypes) unregisterGenuiComponent(t)
  usedTypes.length = 0
})

describe('registerGenuiComponent / resolveGenuiComponent', () => {
  it('注册后 resolve 返回同一组件引用', () => {
    register('reg-a')
    expect(resolveGenuiComponent('reg-a')).toBe(Dummy)
  })

  it('不同 type 各自返回注册的组件，互不串扰', () => {
    register('reg-a', Dummy)
    register('reg-other', Other)
    expect(resolveGenuiComponent('reg-a')).toBe(Dummy)
    expect(resolveGenuiComponent('reg-other')).toBe(Other)
  })

  it('空串 type 静默忽略不注册', () => {
    registerGenuiComponent('', Dummy)
    expect(resolveGenuiComponent('')).toBeUndefined()
  })

  it('纯空白 type 静默忽略不注册', () => {
    registerGenuiComponent('   ', Dummy)
    expect(resolveGenuiComponent('   ')).toBeUndefined()
  })

  it('未注册的 type resolve 返回 undefined', () => {
    expect(resolveGenuiComponent('never-registered-type')).toBeUndefined()
  })
})

describe('unregisterGenuiComponent', () => {
  it('注销后 resolve 返回 undefined', () => {
    register('reg-b')
    expect(resolveGenuiComponent('reg-b')).toBe(Dummy)
    unregisterGenuiComponent('reg-b')
    expect(resolveGenuiComponent('reg-b')).toBeUndefined()
  })
})
