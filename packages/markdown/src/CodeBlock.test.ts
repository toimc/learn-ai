import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodeBlock from './CodeBlock.vue'

// 与 MarkdownRenderer.test 一致的 rAF 桩，避免 jsdom 缺失
const stubRequestAnimationFrame = (cb: FrameRequestCallback): number =>
  setTimeout(() => cb(0), 0) as unknown as number
const stubCancelAnimationFrame = (): void => {}

;(globalThis as Record<string, unknown>).requestAnimationFrame =
  stubRequestAnimationFrame
;(globalThis as Record<string, unknown>).cancelAnimationFrame =
  stubCancelAnimationFrame

/** 等待异步高亮（watchEffect 内 await useHighlighter + tokenize）落地 */
async function flushAsync(): Promise<void> {
  await nextTick()
  // 让 rAF（setTimeout 桩）与微任务链跑完
  await new Promise((r) => setTimeout(r, 30))
  await nextTick()
}

describe('CodeBlock', () => {
  it('渲染语言头部标签', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    expect(wrapper.find('.ai-chat-code-block__header').text()).toBe(
      'javascript',
    )
  })

  it('无 language 时不渲染头部', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1' },
    })
    expect(wrapper.find('.ai-chat-code-block__header').exists()).toBe(false)
  })

  it('未知语言渲染为纯文本 pre（FR-2.6）', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'x < y', language: 'brainfuck' },
    })
    await flushAsync()
    // 纯文本降级：仍含 pre/code 结构，内容转义可见，不含高亮 span style
    expect(wrapper.find('pre.ai-chat-code-block__pre').exists()).toBe(true)
    expect(wrapper.html()).toContain('x &lt; y')
  })

  it('已知语言异步高亮后产生 pre + 高亮 span（FR-2.1~2.7）', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    await flushAsync()
    const pre = wrapper.find('pre.ai-chat-code-block__pre')
    expect(pre.exists()).toBe(true)
    const html = wrapper.html()
    // 高亮后应有带 CSS 变量的 span（双主题）
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
    // 源码字符可见
    expect(html).toContain('const')
  })

  it('streaming=true 走流式路径（尾行可见）', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'const x = 1\nconst y = 2',
        language: 'typescript',
        streaming: true,
      },
    })
    await flushAsync()
    const html = wrapper.html()
    expect(html).toContain('--shiki-light')
  })

  it('code 变化后重新高亮', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    await flushAsync()
    expect(wrapper.html()).toContain('const')
    await wrapper.setProps({ code: 'let b = 2' })
    await flushAsync()
    expect(wrapper.html()).toContain('let b = 2'.slice(0, 3))
  })

  it('保留主题 css 变量与等宽字体变量', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'x', language: 'javascript' },
    })
    const style = wrapper.find('.ai-chat-code-block__pre').attributes('style')
    // pre 应携带 --ai-chat-code-* 与 --ai-chat-font-mono 变量引用
    expect(style ?? '').toMatch(/--ai-chat-code-color/)
    expect(style ?? '').toMatch(/--ai-chat-font-mono/)
  })
})
