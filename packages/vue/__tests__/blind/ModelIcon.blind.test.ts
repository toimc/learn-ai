/**
 * 双盲测试：ModelIcon
 * 契约来源：packages/docs/components/model-icon.md（未读实现源码）
 * 文档写明：已知厂商 aria-label 为品牌名（如 OpenAI）；未知走 i18n modelIcon.unknown（中文「未知模型」）
 */
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelIcon, setAiChatLocale } from '@toimc/vue'
import type { ModelVendor } from '@toimc/core'

const mounted: VueWrapper[] = []

interface ModelIconProps {
  model: string
  vendor?: ModelVendor
  size?: number
}

function mountIcon(props: ModelIconProps, slots: Record<string, string> = {}) {
  const w = mount(ModelIcon, { props, slots, attachTo: document.body })
  mounted.push(w)
  return w
}

/** 图标承载元素：svg 本体或 [role=img] 容器 */
function iconEl(w: VueWrapper): Element {
  const svg = w.find('svg')
  if (svg.exists()) return svg.element
  const role = w.find('[role="img"]')
  if (role.exists()) return role.element
  throw new Error('未找到图标承载元素（svg / [role=img]）')
}

/** 边长的可观测形式：width 属性或 inline style（px） */
function edgeLengths(el: Element): string[] {
  const out: string[] = []
  const attr = el.getAttribute('width')
  if (attr) out.push(attr)
  const style = (el as HTMLElement).style?.width
  if (style) out.push(style)
  const styleAttr = el.getAttribute('style') ?? ''
  const m = styleAttr.match(/width:\s*([^;]+)/)
  if (m) out.push(m[1].trim())
  return out
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})
beforeEach(() => setAiChatLocale('en-US'))

describe('ModelIcon（契约：docs/components/model-icon.md）', () => {
  it('gpt-4o 识别 openai：role=img + aria-label 品牌名 OpenAI + 内联 SVG', () => {
    const w = mountIcon({ model: 'gpt-4o' })
    const role = w.find('[role="img"]')
    expect(role.exists()).toBe(true)
    expect(role.attributes('aria-label')).toBe('OpenAI')
    expect(w.find('svg').exists()).toBe(true)
  })

  it('带 / 前缀的路由型 id 自动取末段识别', () => {
    const w = mountIcon({ model: 'openrouter/anthropic/claude-3.5-sonnet' })
    const label = w.find('[role="img"]').attributes('aria-label') ?? ''
    expect(label.toLowerCase()).toContain('anthropic')
  })

  it('未知厂商降级首字母圆形 + i18n 未知文案（zh：未知模型）', () => {
    setAiChatLocale('zh-CN')
    const w = mountIcon({ model: 'zephyr-7b' })
    expect(w.find('[role="img"]').attributes('aria-label')).toBe('未知模型')
    expect(w.text().trim().toLowerCase()).toBe('z')
  })

  it('vendor 显式覆盖自动识别', () => {
    const w = mountIcon({ model: 'my-proxy-model', vendor: 'zhipu' })
    const label = w.find('[role="img"]').attributes('aria-label') ?? ''
    expect(label.toLowerCase()).toContain('zhipu')
    // 覆盖后走品牌 SVG 而非首字母兜底
    expect(w.find('svg').exists()).toBe(true)
  })

  it('size 默认 18，自定义 32 生效（attr 或 inline style）', () => {
    const def = mountIcon({ model: 'gpt-4o' })
    expect(
      edgeLengths(iconEl(def)).some((s) => s === '18' || s === '18px'),
    ).toBe(true)
    const big = mountIcon({ model: 'gpt-4o', size: 32 })
    expect(
      edgeLengths(iconEl(big)).some((s) => s === '32' || s === '32px'),
    ).toBe(true)
  })

  it('默认插槽覆盖内置图标，容器保留 role=img + aria-label', () => {
    const w = mountIcon(
      { model: 'internal-llm' },
      { default: '<i class="x">custom-icon</i>' },
    )
    expect(w.text()).toContain('custom-icon')
    expect(w.find('[role="img"]').exists()).toBe(true)
    expect(w.find('[role="img"]').attributes('aria-label')).not.toBe('')
    expect(w.findAll('svg')).toHaveLength(0)
  })
})
