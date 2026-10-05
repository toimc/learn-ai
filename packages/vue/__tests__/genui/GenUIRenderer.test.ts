import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import GenUIRenderer from '../../src/genui/GenUIRenderer.vue'
import {
  registerGenuiComponent,
  unregisterGenuiComponent,
} from '../../src/genui/registry'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

const PROBE_TYPE = 'test-probe'
const EMIT_TYPE = 'test-emit'

// 消毒探针：note 普通字符串透传、u 危险 URL 键（被丢后插值为空）、n 用于观察收窄后的类型
const ProbeComponent = defineComponent({
  props: ['note', 'u', 'n'],
  template: '<div class="probe">{{ note }}|{{ u }}|{{ typeof n }}</div>',
})

const EmitComponent = defineComponent({
  emits: ['poke'],
  template:
    '<button class="poke-btn" @click="$emit(\'poke\', \'x\')">go</button>',
})

// 注册表是模块级单例：用独立 type 探测，afterEach 注销清理
afterEach(() => {
  unregisterGenuiComponent(PROBE_TYPE)
  unregisterGenuiComponent(EMIT_TYPE)
})

describe('GenUIRenderer 渲染注册组件', () => {
  it('schema 合法且 type 已注册时渲染该组件并传入 props', () => {
    registerGenuiComponent(PROBE_TYPE, ProbeComponent)
    const w = mount(GenUIRenderer, {
      props: {
        schema: {
          type: PROBE_TYPE,
          props: { note: 'hi', u: 'safe-text', n: 'keep' },
        },
      },
    })
    expect(w.find('.probe').exists()).toBe(true)
    // 普通字符串原样透传：n='keep' 不匹配纯数字正则，仍是 string
    expect(w.get('.probe').text()).toBe('hi|safe-text|string')
  })

  it('消毒接线：javascript: URL 键被丢弃、纯数字字符串收窄为 number', () => {
    registerGenuiComponent(PROBE_TYPE, ProbeComponent)
    const w = mount(GenUIRenderer, {
      props: {
        schema: {
          type: PROBE_TYPE,
          props: { note: 'hi', u: 'javascript:alert(1)', n: '22' },
        },
      },
    })
    // u 键被消毒丢弃 → 组件收不到该 prop → 插值为空；'22' 收窄后 typeof 为 number
    expect(w.get('.probe').text()).toBe('hi||number')
  })
})

describe('GenUIRenderer 非法 schema 降级', () => {
  const invalidSchemas: Array<[string, unknown]> = [
    ['null', null],
    ['空对象（缺 type 与 props）', {}],
    ['数组', [PROBE_TYPE]],
    ['缺 props', { type: PROBE_TYPE }],
    ['type 为空串', { type: '', props: {} }],
    ['props 为数组', { type: PROBE_TYPE, props: [] }],
  ]

  it.each(invalidSchemas)(
    '非法 schema（%s）渲染 #fallback slot 而非注册组件',
    (_name, schema) => {
      registerGenuiComponent(PROBE_TYPE, ProbeComponent)
      const w = mount(GenUIRenderer, {
        props: { schema },
        slots: { fallback: '<div class="custom-fb">fallback-content</div>' },
      })
      expect(w.get('.custom-fb').text()).toBe('fallback-content')
      expect(w.find('.probe').exists()).toBe(false)
    },
  )

  it('无 fallback slot 时渲染默认降级提示（非法 schema 文案）', () => {
    const w = mount(GenUIRenderer, { props: { schema: null } })
    expect(w.get('.ai-chat-genui-fallback').text()).toBe('界面数据格式无效')
  })
})

describe('GenUIRenderer 未注册 type 降级', () => {
  // 注册表非空下断言：封闭集失效（未注册 type 解析到其他已注册组件）必须被抓
  beforeEach(() => registerGenuiComponent(PROBE_TYPE, ProbeComponent))

  it('schema 合法但 type 未注册时渲染 #fallback slot', () => {
    const w = mount(GenUIRenderer, {
      props: { schema: { type: 'ghost', props: {} } },
      slots: { fallback: '<div class="custom-fb">use-toolcall-panel</div>' },
    })
    expect(w.get('.custom-fb').text()).toBe('use-toolcall-panel')
    expect(w.find('.probe').exists()).toBe(false)
  })

  it('无 fallback slot 时默认提示带出 type 名便于排查', () => {
    const w = mount(GenUIRenderer, {
      props: { schema: { type: 'ghost', props: {} } },
    })
    expect(w.get('.ai-chat-genui-fallback').text()).toBe(
      '未注册的界面组件：ghost',
    )
    expect(w.find('.probe').exists()).toBe(false)
  })
})

describe('GenUIRenderer 事件透传', () => {
  it('子组件自定义事件经 attrs fallthrough 到宿主监听', async () => {
    registerGenuiComponent(EMIT_TYPE, EmitComponent)
    const onPoke = vi.fn()
    const w = mount(GenUIRenderer, {
      props: {
        schema: { type: EMIT_TYPE, props: {} },
        onPoke,
      },
    })
    await w.get('.poke-btn').trigger('click')
    expect(onPoke).toHaveBeenCalledTimes(1)
    expect(onPoke).toHaveBeenCalledWith('x')
  })
})
