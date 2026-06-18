import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

  // CodeBlock 经 createApp 单独挂载，不在测试 wrapper 组件树内，
  // 故用 DOM 结构断言（原 language-js 占位被替换）而非 findAllComponents
  it('代码块被 CodeBlock 接管（原 pre/code 占位被替换）', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '```js\nconst a = 1\n```' },
    })
    await flushPromises()
    await flushPromises()
    expect(wrapper.html()).not.toContain('class="language-js"')
    expect(wrapper.find('.ai-chat-code-block').exists()).toBe(true)
  })

  it('mermaid 占位被 MermaidBlock 接管', async () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '```mermaid\nflowchart LR\nA-->B\n```' },
    })
    await flushPromises()
    await flushPromises()
    expect(wrapper.find('.ai-chat-mermaid').exists()).toBe(true)
  })
})
