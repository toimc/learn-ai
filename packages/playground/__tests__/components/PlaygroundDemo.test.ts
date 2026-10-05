import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PlaygroundDemo from '../../src/components/PlaygroundDemo.vue'
import { setAiChatLocale, useSpeechOutput } from '@toimc/vue'
import {
  MockSpeechRecognition,
  mockSpeechSynthesis,
} from '../../../../tests/mocks/speech'

let wrapper: VueWrapper | null = null

function mountDemo(): VueWrapper {
  wrapper = mount(PlaygroundDemo)
  return wrapper
}

beforeAll(() => setAiChatLocale('zh-CN', { persist: false }))

beforeEach(() => {
  // 挂载期会探活 dev-server / 恢复 provider 注册：统一按离线处理，
  // 测试只关心本地 mock 链路（两条路径内部均已捕获，不会产生未处理拒绝）
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  localStorage.clear()
  MockSpeechRecognition.instances = []
  mockSpeechSynthesis().queue.length = 0
  // useSpeechOutput 的 enabled 是模块级单例开关，复位避免跨用例泄漏
  useSpeechOutput().enabled.value = false
})

describe('PlaygroundDemo 语音集成', () => {
  it('输入区工具栏渲染麦克风按钮，点击开始录音并进入录音态', async () => {
    const w = mountDemo()
    const mic = w.find('.pg-input-area .ai-chat-prompt-mic')
    expect(mic.exists()).toBe(true)

    await mic.get('button').trigger('click')
    expect(MockSpeechRecognition.instances.at(-1)?.start).toHaveBeenCalledTimes(
      1,
    )
    expect(mic.get('button').attributes('title')).toBe('停止录音')
  })

  it('助手消息操作行渲染朗读按钮（title=朗读）', () => {
    const w = mountDemo()
    // 会话 1（思考过程演示）自带 assistant 消息
    const speakBtns = w.findAll('button[title="朗读"]')
    expect(speakBtns.length).toBeGreaterThan(0)
  })

  it('顶栏自动朗读开关：点击开→aria-pressed 与 localStorage 同步，再点回关', async () => {
    const w = mountDemo()
    const btn = w.get('.pg-speak-toggle')
    expect(btn.attributes('aria-pressed')).toBe('false')

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('ai-chat-speech-output')).toBe('true')

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem('ai-chat-speech-output')).toBe('false')
  })

  it('自动朗读开启后发送消息，流式回复逐句进朗读队列', async () => {
    const w = mountDemo()
    await w.get('.pg-speak-toggle').trigger('click')

    const textarea = w.get('textarea')
    await textarea.setValue('你好')
    await textarea.trigger('keydown', { key: 'Enter' })

    await vi.waitFor(
      () => {
        expect(mockSpeechSynthesis().queue.length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
    // 入队内容应是 mock 剧本的句段（句末标点切分），非空字符串
    const first = mockSpeechSynthesis().queue[0] as { text: string }
    expect(first.text.trim().length).toBeGreaterThan(0)
  })

  it('自动朗读关闭时发送消息，流式回复不进朗读队列', async () => {
    const w = mountDemo()
    const textarea = w.get('textarea')
    await textarea.setValue('你好')
    await textarea.trigger('keydown', { key: 'Enter' })

    await new Promise((r) => setTimeout(r, 400))
    expect(mockSpeechSynthesis().queue.length).toBe(0)
  })
})
