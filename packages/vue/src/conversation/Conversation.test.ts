import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, inject } from 'vue'
import Conversation from './Conversation.vue'
import { messageLayoutKey } from '../composables/layout-types'

describe('Conversation 布局', () => {
  it('默认 layout=stacked / messageAlign=left', () => {
    const wrapper = mount(Conversation)
    expect(wrapper.props('layout')).toBe('stacked')
    expect(wrapper.props('messageAlign')).toBe('left')
  })

  it('把 layout/messageAlign 通过 messageLayoutKey 下发（响应式）', async () => {
    const Probe = defineComponent({
      setup() {
        const ctx = inject(messageLayoutKey)
        return () =>
          h(
            'div',
            { class: 'probe' },
            ctx ? `${ctx.value.layout}:${ctx.value.messageAlign}` : 'none',
          )
      },
    })
    const wrap = mount(Conversation, {
      props: { layout: 'im', messageAlign: 'right' },
      slots: { default: Probe },
    })
    expect(wrap.find('.probe').text()).toBe('im:right')
    await wrap.setProps({ messageAlign: 'left' })
    expect(wrap.find('.probe').text()).toBe('im:left')
  })
})
