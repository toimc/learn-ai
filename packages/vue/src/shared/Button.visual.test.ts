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

  it('样式为 scoped（宿主未分层 button reset 不击穿边框与背景）', () => {
    // 层级战事实：未分层 reset（Tailwind preflight / modern-normalize 的
    // `button { border: 0; background: transparent }`）压过一切 @layer，
    // 只有 scoped 的属性选择器特异性能赢（style-isolation.md §2 例外条款）
    expect(source).toContain('<style scoped>')
  })
})
