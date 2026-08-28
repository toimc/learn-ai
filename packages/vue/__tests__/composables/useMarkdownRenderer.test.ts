import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  provideMarkdownRenderer,
  useMarkdownRenderer,
} from '../../src/composables/useMarkdownRenderer'

const DummyRenderer = defineComponent({ template: '<div>md</div>' })

/** useMarkdownRenderer 依赖组件实例的 inject，包一层宿主组件验证 provide/inject 对 */
const Consumer = defineComponent({
  setup() {
    const renderer = useMarkdownRenderer()
    return { renderer }
  },
  template: '<span class="consumer">{{ renderer ? "yes" : "no" }}</span>',
})

describe('useMarkdownRenderer 注入链', () => {
  it('正常：provide 后 inject 返回注入的组件', () => {
    const Host = defineComponent({
      components: { Consumer },
      setup() {
        provideMarkdownRenderer(DummyRenderer)
      },
      template: '<Consumer />',
    })
    const w = mount(Host)
    expect(w.get('.consumer').text()).toBe('yes')
  })

  it('异常：未 provide 时返回 null（回退纯文本渲染）', () => {
    const w = mount(Consumer)
    expect(w.get('.consumer').text()).toBe('no')
  })
})
