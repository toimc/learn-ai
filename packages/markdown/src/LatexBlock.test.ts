import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LatexBlock from './LatexBlock.vue'

describe('LatexBlock', () => {
  it('有效行内公式渲染出 katex 标记（FR-3.1）', () => {
    const wrapper = mount(LatexBlock, {
      props: { formula: 'a^2 + b^2 = c^2' },
    })
    // katex.renderToString 输出一定包含 .katex 类根节点
    expect(wrapper.html()).toContain('katex')
    // 公式内容经 MathML/HTML 落地（上标 a²）
    expect(wrapper.html()).toContain('a')
  })

  it('块级公式 display=true 仍走 katex 渲染（FR-3.2）', () => {
    const wrapper = mount(LatexBlock, {
      props: { formula: '\\int_0^1 x^2 dx', display: true },
    })
    expect(wrapper.html()).toContain('katex')
    // 块级容器带 --display 修饰类
    expect(wrapper.find('.ai-chat-latex--display').exists()).toBe(true)
  })

  it('非法公式回退为源文本而不抛错（FR-3.3）', () => {
    // \notacmd{ 是 KaTeX 无法解析的语法，throwOnError:true 会抛
    const wrapper = mount(LatexBlock, {
      props: { formula: '\\notacmd{' },
    })
    const html = wrapper.html()
    // 不应崩溃，且不产生 katex 渲染节点
    expect(html).not.toContain('class="katex"')
    // 源文本可见（HTML 中至少能看到 notacmd 文本，允许被转义）
    expect(html).toContain('notacmd')
  })

  it('formula 变化时重新渲染', async () => {
    const wrapper = mount(LatexBlock, {
      props: { formula: 'x' },
    })
    expect(wrapper.html()).toContain('katex')
    await wrapper.setProps({ formula: 'y^2' })
    // 重新渲染后仍是 katex 输出
    expect(wrapper.html()).toContain('katex')
  })
})
