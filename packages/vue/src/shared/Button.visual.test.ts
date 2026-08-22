import { describe, it, expect } from 'vitest'
import source from './Button.vue?raw'

/**
 * 视觉守护用例：jsdom 不级联 <style>，focus/active 无法走 DOM 断言，
 * 改为对源码样式的字面量守护（防 token 回退为硬编码 hex / ring 被误删）。
 */

describe('Button 视觉令牌守护', () => {
  it('样式零硬编码色值（无 hex 字面量）', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('键盘可达：声明 :focus-visible ring', () => {
    expect(source).toContain(':focus-visible')
  })

  it('高度对齐控件令牌体系（control-height）', () => {
    expect(source).toContain('var(--ai-chat-control-height')
  })

  it('尊重 prefers-reduced-motion', () => {
    expect(source).toContain('prefers-reduced-motion')
  })

  it('无 !important（宿主靠层顺序覆盖）', () => {
    expect(source).not.toContain('!important')
  })
})
