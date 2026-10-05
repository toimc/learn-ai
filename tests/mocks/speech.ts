import { vi, type Mock } from 'vitest'

/**
 * Web Speech API 的 jsdom mock 基础设施。
 * jsdom 不实现 SpeechRecognition / speechSynthesis，由 tests/setup.ts 统一注入；
 * mock 只提供被测代码用到的最小面，行为（回调触发时机）由测试手动驱动。
 */

/** SpeechRecognition 构造的 mock：实例记录在 instances，回调由测试手动触发 */
export class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []

  lang = ''
  continuous = false
  interimResults = false
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>
      }) => void)
    | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start: Mock = vi.fn()
  stop: Mock = vi.fn()
  abort: Mock = vi.fn()

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }
}

/** SpeechSynthesisUtterance 的 mock：暴露 text/lang/voice 与 onstart/onend/onerror */
export class MockSpeechSynthesisUtterance {
  text: string
  lang = ''
  voice: unknown = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

/** speechSynthesis 的 mock：extends EventTarget 使 voiceschanged 可真实 dispatch */
export class MockSpeechSynthesis extends EventTarget {
  /** getVoices 的返回值；测试直接赋值模拟声音列表（异步加载前后） */
  voices: Array<{ lang: string; name: string }> = []
  /** speak 入队的 utterance，按入队顺序排列 */
  queue: MockSpeechSynthesisUtterance[] = []
  cancel: Mock = vi.fn()
  speak: Mock = vi.fn((utterance: unknown) => {
    this.queue.push(utterance as MockSpeechSynthesisUtterance)
  })

  getVoices(): Array<{ lang: string; name: string }> {
    return this.voices
  }
}

let synth: MockSpeechSynthesis | null = null

/** 全局 speechSynthesis mock 单例（测试断言入口） */
export function mockSpeechSynthesis(): MockSpeechSynthesis {
  if (!synth)
    throw new Error(
      'speech mocks 未安装：先经 tests/setup.ts 调用 installSpeechMocks',
    )
  return synth
}

/** 构造 onresult 事件：transcripts 按序映射为 event.results[i][0].transcript */
export function recognitionEvent(...transcripts: string[]): {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
} {
  return { results: transcripts.map((transcript) => [{ transcript }]) }
}

/** 模拟队列朗读完毕：按序触发每个 utterance 的 onend 并清空队列 */
export function flushSpeaking(): void {
  if (!synth) return
  for (const utterance of synth.queue) utterance.onend?.()
  synth.queue.length = 0
}

export function installSpeechMocks(): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as Record<string, unknown>
  if (!w.SpeechRecognition) w.SpeechRecognition = MockSpeechRecognition
  if (!w.webkitSpeechRecognition)
    w.webkitSpeechRecognition = MockSpeechRecognition
  if (!synth) {
    synth = new MockSpeechSynthesis()
    Object.defineProperty(window, 'speechSynthesis', {
      value: synth,
      configurable: true,
      writable: true,
    })
  }
  w.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance
}
