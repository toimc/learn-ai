import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { aiChatI18n } from '@toimc/vue'

const { renderMock } = vi.hoisted(() => ({ renderMock: vi.fn() }))
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: renderMock },
}))
// import AFTER mock setup (vi.mock is hoisted automatically)
import MermaidBlock from '../../src/components/MermaidBlock.vue'

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
    // 失败占位走字典（与当前 locale 联动）
    expect(wrapper.text()).toContain(
      aiChatI18n.global.t('markdown.renderFailed'),
    )
    expect(wrapper.text()).toContain('broken')
  })

  it('loading 状态显示占位', async () => {
    renderMock.mockReturnValue(new Promise(() => {})) // 永不 resolve → 停在 loading
    const wrapper = mount(MermaidBlock, {
      props: { code: 'flowchart LR\nA-->B' },
    })
    await flushPromises()
    expect(wrapper.find('.ai-chat-mermaid__loading').exists()).toBe(true)
  })

  it('props.code 变化时取最新渲染，陈旧渲染不覆盖', async () => {
    let resolveA!: (v: { svg: string }) => void
    let resolveB!: (v: { svg: string }) => void
    renderMock.mockReturnValueOnce(
      new Promise<{ svg: string }>((r) => {
        resolveA = r
      }),
    )
    const wrapper = mount(MermaidBlock, { props: { code: 'A' } })
    await flushPromises()

    renderMock.mockReturnValueOnce(
      new Promise<{ svg: string }>((r) => {
        resolveB = r
      }),
    )
    await wrapper.setProps({ code: 'B' })

    resolveB({ svg: '<svg>B</svg>' }) // 最新先完成
    await flushPromises()
    expect(wrapper.html()).toContain('B')

    resolveA({ svg: '<svg>A</svg>' }) // 陈旧后完成，必须不覆盖
    await flushPromises()
    expect(wrapper.html()).not.toContain('A')
    expect(wrapper.html()).toContain('B')
  })
})
