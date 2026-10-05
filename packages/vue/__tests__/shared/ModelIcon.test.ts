import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelIcon from '../../src/shared/ModelIcon.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('ModelIcon 厂商识别', () => {
  it('gpt-4o 识别为 openai：渲染 svg + role=img + aria-label=OpenAI + 品牌色 path', () => {
    const w = mount(ModelIcon, { props: { model: 'gpt-4o' } })
    const svg = w.get('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('OpenAI')
    // OpenAI 品牌色为黑（path 数据源自 @lobehub/icons Mono）
    expect(svg.get('path').attributes('fill')).toBe('#000000')
  })

  it('claude-sonnet-4 识别为 anthropic：path 品牌色 #D97706', () => {
    const w = mount(ModelIcon, { props: { model: 'claude-sonnet-4' } })
    expect(w.get('svg path').attributes('fill')).toBe('#D97706')
    expect(w.get('svg').attributes('aria-label')).toBe('Anthropic')
  })

  it('斜杠前缀 openrouter/anthropic/claude-3 取末段识别为 anthropic', () => {
    const w = mount(ModelIcon, {
      props: { model: 'openrouter/anthropic/claude-3.5-sonnet' },
    })
    expect(w.get('svg').attributes('aria-label')).toBe('Anthropic')
  })

  it('vendor prop 覆盖自动识别：openai 型 id 指定 vendor=anthropic', () => {
    const w = mount(ModelIcon, {
      props: { model: 'gpt-4o', vendor: 'anthropic' },
    })
    expect(w.get('svg').attributes('aria-label')).toBe('Anthropic')
    expect(w.get('svg path').attributes('fill')).toBe('#D97706')
  })

  it('qwen-max / glm-4 / deepseek-chat / kimi-k2 分别命中各自品牌色', () => {
    const cases: Array<[string, string, string]> = [
      ['qwen-max', 'Qwen', '#615EFF'],
      ['glm-4-plus', 'Zhipu', '#3859FF'],
      ['deepseek-chat', 'DeepSeek', '#4D6BFE'],
      ['kimi-k2-0905-preview', 'Moonshot', '#16191E'],
    ]
    for (const [model, label, color] of cases) {
      const w = mount(ModelIcon, { props: { model } })
      expect(w.get('svg').attributes('aria-label')).toBe(label)
      expect(w.get('svg path').attributes('fill')).toBe(color)
    }
  })
})

describe('ModelIcon 尺寸', () => {
  it('默认 size=18：svg width/height 为 18', () => {
    const w = mount(ModelIcon, { props: { model: 'gpt-4o' } })
    expect(w.get('svg').attributes('width')).toBe('18')
    expect(w.get('svg').attributes('height')).toBe('18')
  })

  it('size=24：svg width/height 为 24', () => {
    const w = mount(ModelIcon, { props: { model: 'gpt-4o', size: 24 } })
    expect(w.get('svg').attributes('width')).toBe('24')
    expect(w.get('svg').attributes('height')).toBe('24')
  })
})

describe('ModelIcon 兜底与插槽', () => {
  it('未知模型渲染首字母圆形：foobar → F，aria-label 走 i18n 未知模型', () => {
    const w = mount(ModelIcon, { props: { model: 'foobar-x' } })
    expect(w.find('svg').exists()).toBe(false)
    const fallback = w.get('.ai-chat-model-icon--fallback')
    expect(fallback.text()).toBe('F')
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe('未知模型')
    expect(fallback.attributes('style')).toContain('width: 18px')
  })

  it('未知模型尺寸同步：size=32 时圆形 width/height=32、字号减半', () => {
    const w = mount(ModelIcon, { props: { model: 'zzz', size: 32 } })
    const style = w.get('.ai-chat-model-icon--fallback').attributes('style')
    expect(style).toContain('width: 32px')
    expect(style).toContain('font-size: 16px')
  })

  it('默认插槽覆盖内置 SVG：自定义图标逃生口', () => {
    const w = mount(ModelIcon, {
      props: { model: 'gpt-4o' },
      slots: { default: '<img class="custom" src="x.png" alt="" />' },
    })
    expect(w.find('svg').exists()).toBe(false)
    expect(w.find('.custom').exists()).toBe(true)
    // 插槽容器仍保留无障碍语义
    expect(w.get('.ai-chat-model-icon--custom').attributes('role')).toBe('img')
    expect(w.get('.ai-chat-model-icon--custom').attributes('aria-label')).toBe(
      'OpenAI',
    )
  })
})
