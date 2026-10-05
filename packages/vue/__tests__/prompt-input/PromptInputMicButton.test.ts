import { describe, expect, it, vi, afterEach, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import PromptInput from '../../src/prompt-input/PromptInput.vue'
import PromptInputTextarea from '../../src/prompt-input/PromptInputTextarea.vue'
import PromptInputMicButton from '../../src/prompt-input/PromptInputMicButton.vue'
import { setAiChatLocale } from '../../src/locales'
import type { SpeechRecognitionLike } from '../../src/composables/useSpeechInput'

/** 假 SpeechRecognition：记录实例与 start/stop 调用，供测试手动派发事件 */
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
  constructor() {
    FakeRecognition.instances.push(this)
  }
  /** 模拟一段识别结果（已定稿 + 中间结果各一条） */
  emitResult(transcript: string) {
    this.onresult?.({
      results: [[{ transcript }], [{ transcript: '' }]] as ArrayLike<
        ArrayLike<{ transcript: string }>
      >,
    })
  }
}

function mountWithMic() {
  return mount(PromptInput, {
    slots: {
      default: () => [h(PromptInputTextarea), h(PromptInputMicButton)],
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeRecognition.instances = []
})

describe('PromptInputMicButton', () => {
  // jsdom 的 navigator.language 为 en-US，模块加载时语言被初始化为英文；
  // 断言用中文文案（字典即文档），统一固定回中文
  beforeAll(() => setAiChatLocale('zh-CN', { persist: false }))

  it('浏览器不支持语音识别时整个组件不渲染', () => {
    // tests/setup.ts 全局装了 SpeechRecognition mock，显式摘除模拟不支持
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    const w = mountWithMic()
    expect(w.find('.ai-chat-prompt-mic').exists()).toBe(false)
  })

  it('支持时渲染麦克风按钮，点击开始录音（start 被调用）', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const w = mountWithMic()
    const btn = w.get('.ai-chat-prompt-mic button')
    expect(btn.attributes('title')).toBe('语音输入')

    await btn.trigger('click')
    expect(FakeRecognition.instances[0]?.start).toHaveBeenCalledTimes(1)
    // 录音中按钮 title 切换为停止
    expect(w.get('.ai-chat-prompt-mic button').attributes('title')).toBe(
      '停止录音',
    )
  })

  it('录音中实时字幕展示 interimText', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const w = mountWithMic()
    await w.get('.ai-chat-prompt-mic button').trigger('click')

    FakeRecognition.instances[0]!.emitResult('北京今天')
    await Promise.resolve()
    expect(w.get('.ai-chat-prompt-mic__interim').text()).toBe('北京今天')
  })

  it('录音结束后最终识别文本追加进输入框（已有文本时以空格衔接）', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const w = mountWithMic()
    const textarea = w.get('textarea').element as HTMLTextAreaElement

    // 先手动输入已有文本
    await w.get('textarea').setValue('查一下')
    expect(textarea.value).toBe('查一下')

    await w.get('.ai-chat-prompt-mic button').trigger('click')
    const rec = FakeRecognition.instances[0]!
    rec.emitResult('北京天气')
    rec.onend?.()
    await Promise.resolve()

    expect(textarea.value).toBe('查一下 北京天气')
  })

  it('识别出错时字幕区展示翻译后的错误文案（no-speech）', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const w = mountWithMic()
    await w.get('.ai-chat-prompt-mic button').trigger('click')

    const rec = FakeRecognition.instances[0]!
    rec.onerror?.({ error: 'no-speech' })
    rec.onend?.()
    await Promise.resolve()

    expect(w.get('.ai-chat-prompt-mic__error').text()).toBe(
      '没有听到语音，请再试一次',
    )
  })

  it('未知错误码展示原始码', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const w = mountWithMic()
    await w.get('.ai-chat-prompt-mic button').trigger('click')

    const rec = FakeRecognition.instances[0]!
    rec.onerror?.({ error: 'audio-capture' })
    rec.onend?.()
    await Promise.resolve()

    expect(w.get('.ai-chat-prompt-mic__error').text()).toBe('audio-capture')
  })
})
