import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const stubRequestAnimationFrame = (cb: FrameRequestCallback): number =>
  setTimeout(() => cb(0), 0) as unknown as number
const stubCancelAnimationFrame = (): void => {}

;(globalThis as Record<string, unknown>).requestAnimationFrame =
  stubRequestAnimationFrame
;(globalThis as Record<string, unknown>).cancelAnimationFrame =
  stubCancelAnimationFrame

describe('MarkdownRenderer', () => {
  it('渲染标题与列表', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# H\n- a\n- b' },
    })
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.html()).toContain('<h1>H</h1>')
    expect(wrapper.html()).toContain('<ul>')
  })
  it('streaming prop 存在时不报错', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '流式中...', streaming: true },
    })
    await nextTick()
    expect(wrapper.find('.ai-chat-markdown').exists()).toBe(true)
  })
})
