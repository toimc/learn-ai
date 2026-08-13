import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Conversation from '../conversation/Conversation.vue'
import { presets } from '../theme/presets'

describe('Conversation 主题 Props', () => {
  it('默认 theme=default：根元素 inline style 含预设 accent 变量', () => {
    const wrapper = mount(Conversation)
    const el = wrapper.element as HTMLElement
    // useThemePreset 在 onMounted 时套入 default 预设
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      presets.default.vars['--ai-chat-color-accent-500'],
    )
    expect(el.style.getPropertyValue('--ai-chat-color-accent-600')).toBe(
      presets.default.vars['--ai-chat-color-accent-600'],
    )
    wrapper.unmount()
  })

  it('theme=purple：根元素含 purple 预设变量', () => {
    const wrapper = mount(Conversation, { props: { theme: 'purple' } })
    const el = wrapper.element as HTMLElement
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      presets.purple.vars['--ai-chat-color-accent-500'],
    )
    expect(el.style.getPropertyValue('--ai-chat-color-accent-hover')).toBe(
      presets.purple.vars['--ai-chat-color-accent-hover'],
    )
    wrapper.unmount()
  })

  it('customTheme：自定义变量写入根元素 inline style', () => {
    const custom = {
      '--ai-chat-color-accent-500': '#ff00ff',
      '--ai-chat-radius-lg': '20px',
    }
    const wrapper = mount(Conversation, { props: { customTheme: custom } })
    const el = wrapper.element as HTMLElement
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      '#ff00ff',
    )
    expect(el.style.getPropertyValue('--ai-chat-radius-lg')).toBe('20px')
    wrapper.unmount()
  })

  it('customTheme 覆盖预设：customTheme 优先级高于预设', () => {
    const wrapper = mount(Conversation, {
      props: {
        theme: 'purple',
        customTheme: { '--ai-chat-color-accent-500': '# overridden' },
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      '# overridden',
    )
    // 预设的其他变量仍生效
    expect(el.style.getPropertyValue('--ai-chat-color-accent-600')).toBe(
      presets.purple.vars['--ai-chat-color-accent-600'],
    )
    wrapper.unmount()
  })

  it('darkMode=true：根元素 data-theme=dark（容器级，不污染 documentElement）', () => {
    const wrapper = mount(Conversation, {
      props: { darkMode: true },
    })
    const el = wrapper.element as HTMLElement
    expect(el.getAttribute('data-theme')).toBe('dark')
    wrapper.unmount()
  })

  it('darkMode=false：根元素 data-theme=light', () => {
    const wrapper = mount(Conversation, {
      props: { darkMode: false },
    })
    const el = wrapper.element as HTMLElement
    expect(el.getAttribute('data-theme')).toBe('light')
    wrapper.unmount()
  })

  it('darkMode=auto：根元素不写 data-theme（交由全局）', () => {
    const auto = mount(Conversation, { props: { darkMode: 'auto' } })
    expect(auto.element.getAttribute('data-theme')).toBeNull()
    auto.unmount()
  })

  it('darkMode 缺省：根元素不写 data-theme（交由全局）', () => {
    const none = mount(Conversation)
    expect(none.element.getAttribute('data-theme')).toBeNull()
    none.unmount()
  })

  it('theme 切换时清理旧预设变量、写入新预设', async () => {
    const wrapper = mount(Conversation, { props: { theme: 'purple' } })
    const el = wrapper.element as HTMLElement
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      presets.purple.vars['--ai-chat-color-accent-500'],
    )

    await wrapper.setProps({ theme: 'green' })
    expect(el.style.getPropertyValue('--ai-chat-color-accent-500')).toBe(
      presets.green.vars['--ai-chat-color-accent-500'],
    )
    wrapper.unmount()
  })
})
