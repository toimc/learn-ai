import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import PromptInputSubmit from '../../src/prompt-input/PromptInputSubmit.vue'
import { PROMPT_INPUT_KEY } from '../../src/prompt-input/context'
import { aiChatI18n } from '../../src/locales/index'

// 语区是模块级单例，别的测试可能切到 en；本文件断言中文文案，进出复位
const savedLocale = aiChatI18n.global.locale.value
beforeEach(() => {
  aiChatI18n.global.locale.value = 'zh-CN'
})
afterEach(() => {
  aiChatI18n.global.locale.value = savedLocale
})

function mountSubmit(status: 'ready' | 'streaming' = 'ready') {
  const submit = vi.fn()
  const abort = vi.fn()
  const w = mount(PromptInputSubmit, {
    global: {
      provide: {
        [PROMPT_INPUT_KEY as symbol]: {
          status: ref(status),
          disabled: () => false,
        },
        promptSubmit: submit,
        promptAbort: abort,
      },
    },
  })
  return { w, submit, abort }
}

describe('PromptInputSubmit', () => {
  it('ready 态点击触发 submit', async () => {
    const { w, submit } = mountSubmit('ready')
    await w.find('button').trigger('click')
    expect(submit).toHaveBeenCalledOnce()
  })

  it('streaming 态点击触发 abort', async () => {
    const { w, abort } = mountSubmit('streaming')
    await w.find('button').trigger('click')
    expect(abort).toHaveBeenCalledOnce()
  })

  it('aria-label 来自字典（ready=发送/stop 态=停止）', () => {
    expect(mountSubmit('ready').w.attributes('aria-label')).toBe('发送')
    expect(mountSubmit('streaming').w.attributes('aria-label')).toBe('停止')
  })

  it('default slot 可自定义图标', () => {
    const w = mount(PromptInputSubmit, {
      slots: { default: '<span class="custom-icon">↑</span>' },
      global: {
        provide: {
          [PROMPT_INPUT_KEY as symbol]: {
            status: ref('ready'),
            disabled: () => false,
          },
          promptSubmit: vi.fn(),
          promptAbort: vi.fn(),
        },
      },
    })
    expect(w.find('.custom-icon').exists()).toBe(true)
    expect(w.find('svg').exists()).toBe(false)
  })
})
