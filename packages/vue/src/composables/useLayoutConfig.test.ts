import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useLayoutConfig } from './useLayoutConfig'

describe('useLayoutConfig', () => {
  it('尺寸字段映射为带 px 的 CSS 变量字典', () => {
    const { vars } = useLayoutConfig({
      contentMaxWidth: 720,
      contentMaxWidthWide: 1100,
      messageMaxWidth: 460,
      inputMaxHeight: 180,
      inputMaxHeightMobile: 100,
      breakpointSm: 400,
      breakpointMd: 600,
      breakpointLg: 900,
      breakpointXl: 1400,
    })
    expect(vars.value).toEqual({
      '--ai-chat-content-max-width': '720px',
      '--ai-chat-content-max-width-wide': '1100px',
      '--ai-chat-message-max-width': '460px',
      '--ai-chat-input-max-height': '180px',
      '--ai-chat-input-max-height-mobile': '100px',
      '--ai-chat-breakpoint-sm': '400px',
      '--ai-chat-breakpoint-md': '600px',
      '--ai-chat-breakpoint-lg': '900px',
      '--ai-chat-breakpoint-xl': '1400px',
    })
  })

  it('layout/messageAlign 进入 layoutProps、不进入 vars', () => {
    const { vars, layoutProps } = useLayoutConfig({
      layout: 'im',
      messageAlign: 'right',
      contentMaxWidth: 800,
    })
    expect(layoutProps.value).toEqual({ layout: 'im', messageAlign: 'right' })
    expect(vars.value).toEqual({ '--ai-chat-content-max-width': '800px' })
  })

  it('未设置的字段不产出变量', () => {
    const { vars } = useLayoutConfig({ messageMaxWidth: 400 })
    expect(vars.value).toEqual({ '--ai-chat-message-max-width': '400px' })
  })

  it('响应式更新', () => {
    const cfg = ref({ contentMaxWidth: 700 })
    const { vars } = useLayoutConfig(cfg)
    expect(vars.value['--ai-chat-content-max-width']).toBe('700px')
    cfg.value = { contentMaxWidth: 900 }
    expect(vars.value['--ai-chat-content-max-width']).toBe('900px')
  })

  it('state 返回当前生效配置', () => {
    const { state } = useLayoutConfig({
      layout: 'stacked',
      breakpointMd: 500,
    })
    expect(state.value.layout).toBe('stacked')
    expect(state.value.breakpointMd).toBe(500)
  })
})
