import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThinkingBlock from './ThinkingBlock.vue'
import { setAiChatLocale } from '../locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('ThinkingBlock 触发器文案', () => {
  it('默认渲染"思考过程"标题，内容区收起', () => {
    const w = mount(ThinkingBlock, { props: { content: '推理内容' } })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('思考过程')
    expect(w.find('.ai-chat-thinking__body').exists()).toBe(false)
  })

  it('streaming 时显示"正在思考…"并强制展开内容', () => {
    const w = mount(ThinkingBlock, {
      props: { content: '推理中', streaming: true },
    })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('正在思考…')
    expect(w.get('.ai-chat-thinking__body').text()).toBe('推理中')
    expect(w.find('.ai-chat-thinking__cursor').exists()).toBe(true)
    expect(w.classes()).toContain('ai-chat-thinking--streaming')
  })

  it('完成且有耗时显示"已思考 X 秒"', () => {
    const w = mount(ThinkingBlock, {
      props: { content: 'x', duration: 5300 },
    })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('已思考 5.3 秒')
  })

  it('showDuration=false 时即使有耗时也只显示标题', () => {
    const w = mount(ThinkingBlock, {
      props: { content: 'x', duration: 5300, showDuration: false },
    })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('思考过程')
  })
})

describe('ThinkingBlock 时长格式化边界', () => {
  it.each([
    [9500, '9.5'],
    [9999, '10'],
    [10500, '11'],
  ] as const)('duration=%d ms 格式化为 %s 秒', (duration, expected) => {
    const w = mount(ThinkingBlock, { props: { content: 'x', duration } })
    expect(w.get('.ai-chat-thinking__label').text()).toBe(
      `已思考 ${expected} 秒`,
    )
  })

  it.each([0, -100])('duration=%d 视为无耗时，回退标题', (duration) => {
    const w = mount(ThinkingBlock, { props: { content: 'x', duration } })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('思考过程')
  })

  it('duration 缺省时不显示耗时', () => {
    const w = mount(ThinkingBlock, { props: { content: 'x' } })
    expect(w.get('.ai-chat-thinking__label').text()).toBe('思考过程')
  })
})

describe('ThinkingBlock 展开/收起交互', () => {
  it('点击触发器展开内容，再点收起', async () => {
    const w = mount(ThinkingBlock, { props: { content: '第一步…' } })
    await w.get('.ai-chat-thinking__trigger').trigger('click')
    expect(w.classes()).toContain('ai-chat-thinking--expanded')
    expect(w.get('.ai-chat-thinking__body').text()).toBe('第一步…')

    await w.get('.ai-chat-thinking__trigger').trigger('click')
    expect(w.classes()).not.toContain('ai-chat-thinking--expanded')
    expect(w.find('.ai-chat-thinking__body').exists()).toBe(false)
  })

  it('streaming 结束（false）后已展开的内容保持可见', async () => {
    const w = mount(ThinkingBlock, {
      props: { content: '推理', streaming: true },
    })
    await w.get('.ai-chat-thinking__trigger').trigger('click') // isExpanded = true
    await w.setProps({ streaming: false })
    // 展开态：body 由 isExpanded 维持，光标消失
    expect(w.find('.ai-chat-thinking__body').exists()).toBe(true)
    expect(w.find('.ai-chat-thinking__cursor').exists()).toBe(false)
  })

  it('默认插槽渲染在思考文本之后，content 不被覆盖', async () => {
    const w = mount(ThinkingBlock, {
      props: { content: '默认' },
      slots: { default: '<p class="slot-content">自定义推理</p>' },
    })
    await w.get('.ai-chat-thinking__trigger').trigger('click')
    expect(w.find('.slot-content').exists()).toBe(true)
    const text = w.get('.ai-chat-thinking__body').text()
    expect(text).toContain('默认')
    expect(text).toContain('自定义推理')
    // 顺序：思考文本在前，插槽内容在后
    expect(text.indexOf('自定义推理')).toBeGreaterThan(text.indexOf('默认'))
  })
})

describe('ThinkingBlock 默认插槽', () => {
  it('传插槽时工具面板渲染在思考文本之后', () => {
    const w = mount(ThinkingBlock, {
      props: { content: '先思考要不要查天气', streaming: true },
      slots: { default: '<div class="slot-tools">get_weather 工具面板</div>' },
    })
    const body = w.get('.ai-chat-thinking__body')
    const text = body.text()
    expect(text).toContain('先思考要不要查天气')
    expect(text).toContain('get_weather 工具面板')
    expect(text.indexOf('get_weather 工具面板')).toBeGreaterThan(
      text.indexOf('先思考要不要查天气'),
    )
  })

  it('不传插槽时与现状一致：仅思考文本 + 流式光标', () => {
    const w = mount(ThinkingBlock, {
      props: { content: '推理中', streaming: true },
    })
    const body = w.get('.ai-chat-thinking__body')
    expect(body.text()).toBe('推理中')
    // content 保持文本节点（非包裹元素），body 内仅光标一个元素子节点
    expect(body.element.children).toHaveLength(1)
    expect(body.element.children[0].className).toBe('ai-chat-thinking__cursor')
  })
})
