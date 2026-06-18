import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { renderMock } = vi.hoisted(() => ({ renderMock: vi.fn() }))
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: renderMock },
}))
// import AFTER mock setup (vi.mock is hoisted automatically)
import MermaidBlock from './MermaidBlock.vue'

describe('MermaidBlock', () => {
  it('渲染成功：done 状态显示 svg', async () => {
    renderMock.mockResolvedValue({ svg: '<svg>mock</svg>' })
    const wrapper = mount(MermaidBlock, {
      props: { code: 'flowchart LR\nA-->B' },
    })
    await flushPromises()
    expect(wrapper.html()).toContain('mock')
  })

  it('渲染失败：error 状态显示占位 + 源码', async () => {
    renderMock.mockReset()
    renderMock.mockRejectedValue(new Error('bad'))
    const wrapper = mount(MermaidBlock, { props: { code: 'broken' } })
    await flushPromises()
    expect(wrapper.find('.ai-chat-mermaid__error').exists()).toBe(true)
    expect(wrapper.text()).toContain('图表渲染失败')
    expect(wrapper.text()).toContain('broken')
  })
})
