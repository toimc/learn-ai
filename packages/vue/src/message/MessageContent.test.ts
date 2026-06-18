import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import MessageContent from './MessageContent.vue'
import { markdownRendererKey } from '../composables/useMarkdownRenderer'

const FakeRenderer = defineComponent({
  props: ['content'],
  setup: (p: any) => () => h('div', { class: 'fake-renderer' }, `rendered:${p.content}`),
})

describe('MessageContent', () => {
  it('无注入时回退 slot', () => {
    const wrapper = mount(MessageContent, { slots: { default: '纯文本' } })
    expect(wrapper.text()).toContain('纯文本')
    expect(wrapper.find('.fake-renderer').exists()).toBe(false)
  })
  it('有注入 + content prop 时用 renderer', () => {
    const wrapper = mount(MessageContent, {
      props: { content: '# 标题' },
      global: { provide: { [markdownRendererKey as symbol]: FakeRenderer } },
    } as any)
    expect(wrapper.find('.fake-renderer').exists()).toBe(true)
    expect(wrapper.text()).toContain('rendered:# 标题')
  })
})
