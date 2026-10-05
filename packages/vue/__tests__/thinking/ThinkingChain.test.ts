import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ThinkingStep } from '@toimc/core'
import ThinkingChain from '../../src/thinking/ThinkingChain.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeStep(overrides: Partial<ThinkingStep> = {}): ThinkingStep {
  return {
    id: 'step_1',
    title: '解析意图',
    status: 'complete',
    duration: 800,
    content: '识别出用户在问天气',
    ...overrides,
  }
}

describe('ThinkingChain 头部呈现', () => {
  it('渲染默认标题、步骤数与自动求和的总耗时', () => {
    const w = mount(ThinkingChain, {
      props: {
        steps: [
          makeStep({ id: 'a', duration: 800 }),
          makeStep({ id: 'b', duration: 1200 }),
        ],
      },
    })
    expect(w.get('.ai-chat-thinking-chain__header-title').text()).toBe(
      '思考过程',
    )
    // 800 + 1200 = 2000ms → formatDuration 契约 toFixed(1) → '2.0s'（手算字面量）
    expect(w.get('.ai-chat-thinking-chain__header-duration').text()).toBe(
      '2.0s',
    )
    expect(w.get('.ai-chat-thinking-chain__header-count').text()).toBe(
      '2 个步骤',
    )
  })

  it('totalDuration 显式传入时覆盖自动求和', () => {
    const w = mount(ThinkingChain, {
      props: {
        steps: [makeStep({ duration: 800 })],
        totalDuration: 5000,
      },
    })
    expect(w.get('.ai-chat-thinking-chain__header-duration').text()).toBe(
      '5.0s',
    )
  })

  it('自定义 title prop 优先于 i18n 默认', () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], title: '推理链路' },
    })
    expect(w.get('.ai-chat-thinking-chain__header-title').text()).toBe(
      '推理链路',
    )
  })

  it('streaming 时头部显示"正在思考…"', () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], streaming: true },
    })
    expect(w.get('.ai-chat-thinking-chain__header-title').text()).toBe(
      '正在思考…',
    )
  })

  it('边界：空步骤数组不渲染组件根节点', () => {
    const w = mount(ThinkingChain, { props: { steps: [] } })
    expect(w.find('.ai-chat-thinking-chain').exists()).toBe(false)
  })

  it('边界：总耗时为 0 时不渲染耗时节点', () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep({ duration: undefined })] },
    })
    expect(w.find('.ai-chat-thinking-chain__header-duration').exists()).toBe(
      false,
    )
    expect(w.get('.ai-chat-thinking-chain__header-count').text()).toBe(
      '1 个步骤',
    )
  })
})

describe('ThinkingChain 外层开合（复用 ThinkingBlock 状态机）', () => {
  it('默认收起，点击头部展开再点收起', async () => {
    const w = mount(ThinkingChain, { props: { steps: [makeStep()] } })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(false)

    await w.get('.ai-chat-thinking-chain__header').trigger('click')
    expect(w.classes()).toContain('ai-chat-thinking-chain--expanded')
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(true)

    await w.get('.ai-chat-thinking-chain__header').trigger('click')
    expect(w.classes()).not.toContain('ai-chat-thinking-chain--expanded')
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(false)
  })

  it('流式时缺省展开（defaultExpanded 未传时随 streaming）', () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], streaming: true },
    })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(true)
    expect(w.classes()).toContain('ai-chat-thinking-chain--streaming')
  })

  it('defaultExpanded=true 使非流式初始展开', () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], defaultExpanded: true },
    })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(true)
  })

  it('流式结束且用户未干预时自动折叠', async () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], streaming: true },
    })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(true)

    await w.setProps({ streaming: false })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(false)
  })

  it('流式中用户折叠后，流结束保持折叠（用户接管）', async () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], streaming: true },
    })
    await w.get('.ai-chat-thinking-chain__header').trigger('click')
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(false)

    await w.setProps({ streaming: false })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(false)
  })

  it('流式中折叠后再次手动展开，流结束保持展开', async () => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep()], streaming: true },
    })
    await w.get('.ai-chat-thinking-chain__header').trigger('click')
    await w.get('.ai-chat-thinking-chain__header').trigger('click')
    await w.setProps({ streaming: false })
    expect(w.find('.ai-chat-thinking-chain__body').exists()).toBe(true)
  })
})

describe('ThinkingChain 步骤行', () => {
  it.each([
    ['pending', '○', '等待中'],
    ['active', '●', '进行中'],
    ['complete', '✓', '完成'],
    ['error', '✗', '失败'],
  ] as const)('status=%s 渲染图标 %s 与状态标签', (status, icon, label) => {
    const w = mount(ThinkingChain, {
      props: { steps: [makeStep({ status })], defaultExpanded: true },
    })
    expect(w.get('.ai-chat-thinking-chain__step-icon').text()).toBe(icon)
    expect(w.get('.ai-chat-thinking-chain__step-status').text()).toBe(label)
    expect(w.get('.ai-chat-thinking-chain__step').classes()).toContain(
      `ai-chat-thinking-chain__step--${status}`,
    )
  })

  it('步骤耗时格式化：<1s 用 ms，≥1s 用一位小数秒', () => {
    const w = mount(ThinkingChain, {
      props: {
        defaultExpanded: true,
        steps: [
          makeStep({ id: 'a', duration: 800 }),
          makeStep({ id: 'b', duration: 1500 }),
        ],
      },
    })
    const durations = w.findAll('.ai-chat-thinking-chain__step-duration')
    expect(durations).toHaveLength(2)
    expect(durations[0]!.text()).toBe('800ms')
    expect(durations[1]!.text()).toBe('1.5s')
  })

  it('点击步骤行展开 content，再点收起', async () => {
    const w = mount(ThinkingChain, {
      props: {
        steps: [makeStep({ content: '第一步推理细节' })],
        defaultExpanded: true,
      },
    })
    expect(w.find('.ai-chat-thinking-chain__step-content').exists()).toBe(false)

    await w.get('.ai-chat-thinking-chain__step-row').trigger('click')
    expect(w.get('.ai-chat-thinking-chain__step-content').text()).toBe(
      '第一步推理细节',
    )

    await w.get('.ai-chat-thinking-chain__step-row').trigger('click')
    expect(w.find('.ai-chat-thinking-chain__step-content').exists()).toBe(false)
  })

  it('边界：无 content 的步骤点击后不渲染内容区', async () => {
    const w = mount(ThinkingChain, {
      props: {
        steps: [makeStep({ content: undefined })],
        defaultExpanded: true,
      },
    })
    await w.get('.ai-chat-thinking-chain__step-row').trigger('click')
    expect(w.find('.ai-chat-thinking-chain__step-content').exists()).toBe(false)
  })

  it('多步骤按传入顺序渲染 title', () => {
    const w = mount(ThinkingChain, {
      props: {
        defaultExpanded: true,
        steps: [
          makeStep({ id: 'a', title: '解析意图' }),
          makeStep({ id: 'b', title: '检索文档' }),
          makeStep({ id: 'c', title: '生成回答' }),
        ],
      },
    })
    const titles = w
      .findAll('.ai-chat-thinking-chain__step-title')
      .map((n) => n.text())
    expect(titles).toEqual(['解析意图', '检索文档', '生成回答'])
  })
})

describe('ThinkingChain 连接线样式', () => {
  it.each(['solid', 'dashed', 'none'] as const)(
    'line=%s 落在根类名上',
    (line) => {
      const w = mount(ThinkingChain, { props: { steps: [makeStep()], line } })
      expect(w.classes()).toContain(`ai-chat-thinking-chain--line-${line}`)
    },
  )

  it('缺省 line 为 solid', () => {
    const w = mount(ThinkingChain, { props: { steps: [makeStep()] } })
    expect(w.classes()).toContain('ai-chat-thinking-chain--line-solid')
  })
})
