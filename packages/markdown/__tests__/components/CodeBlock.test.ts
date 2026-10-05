import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodeBlock from '../../src/components/CodeBlock.vue'
import { aiChatI18n } from '@toimc/vue'
import { renderCodeFinal } from '../../src/composables/useShikiTokenizer'

// 默认透传真实实现，仅在「高亮异常降级」用例里对单次调用注入 rejection
vi.mock('../../src/composables/useShikiTokenizer', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/composables/useShikiTokenizer')
    >()
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
    // 行为变更（T10）：复制改走 @toimc/core copyText 降级链——优先
    // navigator.clipboard（需 isSecureContext），失败降级 execCommand。
    // jsdom 的 isSecureContext 默认 false，须 stub 为 true 才能命中 clipboard 分支
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
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
    // 行为变更（T10）：writeText reject 后 copyText 落入 execCommand 降级链，
    // jsdom 未实现 execCommand → 返回 false；与旧行为一致地不进已复制态
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.assign(navigator, { clipboard: { writeText } })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
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

describe('CodeBlock 行号与折叠（T10）', () => {
  it('showLineNumbers=true 时每行渲染递增行号，行内容仍来自 Shiki token', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'const a = 1\nconst b = 2',
        language: 'javascript',
        streaming: false,
        showLineNumbers: true,
      },
    })
    await flushAsync()
    const numbers = wrapper.findAll('.ai-chat-code-block__ln')
    expect(numbers.map((n) => n.text())).toEqual(['1', '2'])
    // per-line 渲染不改变 token 来源：双主题 CSS 变量仍在
    expect(wrapper.html()).toContain('--shiki-light')
    expect(wrapper.html()).toContain('--shiki-dark')
  })

  it('默认（不传 showLineNumbers）不渲染行号与 per-line 结构', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'const a = 1', language: 'javascript', streaming: false },
    })
    await flushAsync()
    expect(wrapper.find('.ai-chat-code-block__ln').exists()).toBe(false)
    expect(wrapper.find('.ai-chat-code-block__line').exists()).toBe(false)
  })

  it('collapsibleAfter 默认 0 不折叠：无折叠按钮', async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: 'a\nb\nc\nd', language: 'javascript', streaming: false },
    })
    await flushAsync()
    expect(wrapper.find('.ai-chat-code-block__toggle').exists()).toBe(false)
    expect(wrapper.find('.ai-chat-code-block').classes()).not.toContain(
      'is-collapsed',
    )
  })

  it('超过 collapsibleAfter 行：初始折叠只显示前 N 行，展开/收起可切换', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'a\nb\nc\nd',
        language: 'javascript',
        streaming: false,
        collapsibleAfter: 2,
      },
    })
    await flushAsync()
    // 折叠态：容器修饰类 + 只见前 2 行 + 展开按钮文案走字典
    expect(wrapper.find('.ai-chat-code-block').classes()).toContain(
      'is-collapsed',
    )
    expect(wrapper.findAll('.ai-chat-code-block__line')).toHaveLength(2)
    const toggle = wrapper.find('.ai-chat-code-block__toggle')
    expect(toggle.text()).toBe(aiChatI18n.global.t('codeBlock.expand'))

    await toggle.trigger('click')
    expect(wrapper.findAll('.ai-chat-code-block__line')).toHaveLength(4)
    expect(wrapper.find('.ai-chat-code-block').classes()).not.toContain(
      'is-collapsed',
    )
    expect(wrapper.find('.ai-chat-code-block__toggle').text()).toBe(
      aiChatI18n.global.t('codeBlock.collapse'),
    )

    await wrapper.find('.ai-chat-code-block__toggle').trigger('click')
    expect(wrapper.findAll('.ai-chat-code-block__line')).toHaveLength(2)
  })

  it('行数不超过 collapsibleAfter：全部显示且无折叠按钮', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'a\nb',
        language: 'javascript',
        streaming: false,
        collapsibleAfter: 5,
      },
    })
    await flushAsync()
    expect(wrapper.find('.ai-chat-code-block__toggle').exists()).toBe(false)
    expect(wrapper.find('.ai-chat-code-block').classes()).not.toContain(
      'is-collapsed',
    )
    // 全量行可见
    expect(wrapper.html()).toContain('a')
    expect(wrapper.html()).toContain('b')
  })

  it('streaming=true 期间禁用折叠：无折叠按钮且全部行可见（尾部行未定）', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'a\nb\nc\nd',
        language: 'javascript',
        streaming: true,
        collapsibleAfter: 2,
      },
    })
    await flushAsync()
    expect(wrapper.find('.ai-chat-code-block__toggle').exists()).toBe(false)
    expect(wrapper.find('.ai-chat-code-block').classes()).not.toContain(
      'is-collapsed',
    )
    // 折叠会把 c/d 切掉；禁用折叠时必须仍可见
    expect(wrapper.html()).toContain('c')
    expect(wrapper.html()).toContain('d')
  })

  it('code 更新后折叠态重置（新内容重新从折叠开始）', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'a\nb\nc\nd',
        language: 'javascript',
        streaming: false,
        collapsibleAfter: 2,
      },
    })
    await flushAsync()
    await wrapper.find('.ai-chat-code-block__toggle').trigger('click')
    expect(wrapper.findAll('.ai-chat-code-block__line')).toHaveLength(4)

    await wrapper.setProps({ code: 'e\nf\ng\nh' })
    await flushAsync()
    expect(wrapper.findAll('.ai-chat-code-block__line')).toHaveLength(2)
    expect(wrapper.find('.ai-chat-code-block').classes()).toContain(
      'is-collapsed',
    )
  })

  it('折叠与行号可同时启用：折叠态行号与可见行一一对应', async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: 'a\nb\nc\nd',
        language: 'javascript',
        streaming: false,
        collapsibleAfter: 2,
        showLineNumbers: true,
      },
    })
    await flushAsync()
    expect(
      wrapper.findAll('.ai-chat-code-block__ln').map((n) => n.text()),
    ).toEqual(['1', '2'])
    await wrapper.find('.ai-chat-code-block__toggle').trigger('click')
    expect(
      wrapper.findAll('.ai-chat-code-block__ln').map((n) => n.text()),
    ).toEqual(['1', '2', '3', '4'])
  })
})
