import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodeBlock from './CodeBlock.vue'
import { aiChatI18n } from '@toimc/vue'
import { renderCodeFinal } from './composables/useShikiTokenizer'

// 默认透传真实实现，仅在「高亮异常降级」用例里对单次调用注入 rejection
vi.mock('./composables/useShikiTokenizer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./composables/useShikiTokenizer')>()
  return { ...actual, renderCodeFinal: vi.fn(actual.renderCodeFinal) }
})

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
  it('渲染语言头部标签与复制按钮', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    expect(wrapper.find('.ai-chat-code-block__lang').text()).toBe('javascript')
    expect(wrapper.find('.ai-chat-code-block__copy').exists()).toBe(true)
  })

  it('无 language 时仍渲染头部承载复制按钮，但不显示语言标签', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1' },
    })
    // 复制按钮需在每一个代码块可用 → 头部始终渲染
    expect(wrapper.find('.ai-chat-code-block__header').exists()).toBe(true)
    expect(wrapper.find('.ai-chat-code-block__lang').exists()).toBe(false)
    expect(wrapper.find('.ai-chat-code-block__copy').exists()).toBe(true)
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

  it('pre 不携带内联 color，避免遮蔽 token span 的双主题色', () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'x', language: 'javascript' },
    })
    const style = wrapper.find('.ai-chat-code-block__pre').attributes('style')
    // 关键不变量：pre 不得有内联 color，否则会盖住 token span 自身的 --shiki-* 变量
    expect(style ?? '').not.toMatch(/color/i)
  })

  it('点击复制按钮写入剪贴板并切换为已复制态', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    const btn = wrapper.find('.ai-chat-code-block__copy')
    // 复制按钮 title 走字典（与当前 locale 联动，spec §9）
    expect(btn.attributes('title')).toBe(aiChatI18n.global.t('shared.copy'))
    await btn.trigger('click')
    await flushAsync()
    expect(writeText).toHaveBeenCalledWith('const a = 1')
    expect(btn.classes()).toContain('is-copied')
    expect(btn.attributes('title')).toBe(aiChatI18n.global.t('shared.copied'))
    // 已复制态渲染对勾图标
    expect(wrapper.html()).toContain('polyline')
  })
})

describe('CodeBlock 异常与边界', () => {
  it('异常：剪贴板写入失败时静默放弃，不进入已复制态', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.assign(navigator, { clipboard: { writeText } })
    const wrapper = mount(CodeBlock, {
      props: { code: 'secret', language: 'javascript' },
    })
    const btn = wrapper.find('.ai-chat-code-block__copy')
    await btn.trigger('click')
    await flushAsync()
    expect(writeText).toHaveBeenCalledWith('secret')
    expect(btn.classes()).not.toContain('is-copied')
  })

  it('边界：code 置为空串时清空高亮内容', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript' },
    })
    await flushAsync()
    expect(wrapper.get('.ai-chat-code-block__code').element.innerHTML).not.toBe(
      '',
    )

    await wrapper.setProps({ code: '' })
    await flushAsync()
    expect(wrapper.get('.ai-chat-code-block__code').element.innerHTML).toBe('')
  })

  it('异常：高亮渲染抛错时降级为空串，保留 pre/code 结构', async () => {
    vi.mocked(renderCodeFinal).mockRejectedValueOnce(new Error('shiki boom'))
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript', streaming: false },
    })
    await flushAsync()
    // 降级：无 token span，但结构仍在
    expect(wrapper.find('.ai-chat-code-block__pre').exists()).toBe(true)
    expect(wrapper.get('.ai-chat-code-block__code').element.innerHTML).toBe('')
  })
})
