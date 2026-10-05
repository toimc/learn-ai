import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useSpeechOutput } from '../../src/composables/useSpeechOutput'
import {
  flushSpeaking,
  mockSpeechSynthesis,
} from '../../../../tests/mocks/speech'

// 双盲测试：行为规格来自 packages/docs/guide/speech.md 与任务契约，不读实现源码。
// mock 边界只在 speechSynthesis / localStorage（tests/mocks/speech 全局注入）。

const STORAGE_KEY = 'ai-chat-speech-output'

/** 在组件 setup 内执行工厂（voiceschanged 监听与卸载清理依赖组件作用域），返回工厂产物以便断言 */
function mountSetup<T>(factory: () => T) {
  let exposed!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = factory()
        return () => null
      },
    }),
  )
  return { wrapper, exposed }
}

/** 在组件 setup 内调用 useSpeechOutput，暴露返回值以便断言 */
function mountWithSpeechOutput(options?: { lang?: string }) {
  return mountSetup(() => useSpeechOutput(options))
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  // enabled 是模块级单例，跨用例共享：显式复位，避免上一条用例的开关状态泄漏到下一条
  useSpeechOutput().enabled.value = false
})

afterEach(() => {
  const synth = mockSpeechSynthesis()
  synth.queue.length = 0
  synth.voices = []
  synth.speak.mockClear()
  synth.cancel.mockClear()
  vi.restoreAllMocks()
})

describe('useSpeechOutput enabled 开关与 localStorage 持久化', () => {
  it('正常：enabled 默认关闭，speaking 初始为 false', () => {
    const { exposed } = mountWithSpeechOutput()

    expect(exposed.enabled.value).toBe(false)
    expect(exposed.speaking.value).toBe(false)
  })

  it('正常：toggle 翻转开关并把 true/false 写回 localStorage', async () => {
    const { exposed } = mountWithSpeechOutput()

    exposed.toggle()
    expect(exposed.enabled.value).toBe(true)
    await nextTick()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')

    exposed.toggle()
    expect(exposed.enabled.value).toBe(false)
    await nextTick()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })

  it('正常：直接对 enabled 赋值同样写回 localStorage', async () => {
    const { exposed } = mountWithSpeechOutput()

    exposed.enabled.value = true
    await nextTick()

    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('异常：localStorage 读写抛异常时回退默认开关且各调用不崩溃', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    const { exposed } = mountWithSpeechOutput()
    expect(exposed.enabled.value).toBe(false)

    exposed.toggle()
    expect(exposed.enabled.value).toBe(true)
  })

  it('正常：模块级单例，同页多实例共享同一份 enabled', () => {
    const { exposed } = mountSetup(() => ({
      first: useSpeechOutput(),
      second: useSpeechOutput(),
    }))

    exposed.first.toggle()

    expect(exposed.second.enabled.value).toBe(true)
  })
})

describe('useSpeechOutput enabled 初始化读取', () => {
  // 初始化读 localStorage 发生在模块级单例创建时（早于任何用例），须重载模块才能真正测到读路径
  async function freshUseSpeechOutput() {
    vi.resetModules()
    const mod = await import('../../src/composables/useSpeechOutput')
    return mod.useSpeechOutput()
  }

  it('正常：localStorage 已存 true 时初始化为开启', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')

    const speech = await freshUseSpeechOutput()

    expect(speech.enabled.value).toBe(true)
  })

  it('边界：localStorage 为损坏值时回退关闭', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-boolean')

    const speech = await freshUseSpeechOutput()

    expect(speech.enabled.value).toBe(false)
  })

  it('异常：localStorage 读取抛异常时回退关闭且不崩溃', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })

    const speech = await freshUseSpeechOutput()

    expect(speech.enabled.value).toBe(false)
  })
})

describe('useSpeechOutput feedChunk 流式凑句', () => {
  it('正常：enabled 关闭时 feedChunk 直接丢弃，不入队不缓冲', () => {
    const { exposed } = mountWithSpeechOutput()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('被丢弃的一句。还有下文')

    expect(synth.speak).toHaveBeenCalledTimes(0)
    expect(synth.queue.map((u) => u.text)).toEqual([])

    // 丢弃的文本不应进入缓冲：开启后喂新句，队列里不混入旧文本
    exposed.toggle()
    exposed.feedChunk('新的一句。还有下文')
    expect(synth.queue.map((u) => u.text)).toEqual(['新的一句。'])
  })

  it('正常：开启后连续 chunk 追加同一缓冲，凑满即入队', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('今天天气')
    expect(synth.queue.map((u) => u.text)).toEqual([])
    expect(exposed.speaking.value).toBe(false)

    exposed.feedChunk('怎么样？后面还有内容')
    expect(synth.queue.map((u) => u.text)).toEqual(['今天天气怎么样？'])
    expect(exposed.speaking.value).toBe(true)
  })

  // 契约明文示例：先喂 '今天天气' 再喂 '怎么样？很好。'，队列最终应为两句、缓冲清空。
  // 若实现把最后一段无条件当作 rest（'很好。' 不入队），此处应红——属契约与实现的分歧点，见盲测报告。
  it('正常：chunk 以句末标点收尾时最后一句也应立即入队（契约明文示例）', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('今天天气')
    exposed.feedChunk('怎么样？很好。')

    expect(synth.queue.map((u) => u.text)).toEqual([
      '今天天气怎么样？',
      '很好。',
    ])
  })

  it('边界：尾部未凑满句末标点的文本留在缓冲，等后续 chunk 拼接', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('说了一半')
    expect(synth.speak).toHaveBeenCalledTimes(0)
    expect(exposed.speaking.value).toBe(false)

    exposed.feedChunk('还没完。继续说')
    expect(synth.queue.map((u) => u.text)).toEqual(['说了一半还没完。'])
  })
})

describe('useSpeechOutput speak 手动朗读', () => {
  it('正常：不受 enabled 开关限制，按句入队且尾部残句也朗读', () => {
    const { exposed } = mountWithSpeechOutput()
    const synth = mockSpeechSynthesis()

    exposed.speak('你好。还没说完的残句')

    expect(synth.queue.map((u) => u.text)).toEqual(['你好。', '还没说完的残句'])
    expect(exposed.speaking.value).toBe(true)
  })

  it('正常：speak 无条件先 cancel 旧朗读，再按句入队新文本', () => {
    const { exposed } = mountWithSpeechOutput()
    const synth = mockSpeechSynthesis()

    exposed.speak('旧的一句。旧的二句。')
    expect(synth.cancel).toHaveBeenCalledTimes(1)

    exposed.speak('新的文本。')
    expect(synth.cancel).toHaveBeenCalledTimes(2)
    // mock 的 cancel 不真正清 queue：旧队列被打断由 cancel 调用体现，此处验证新句按序入队
    expect(synth.queue.map((u) => u.text)).toEqual([
      '旧的一句。',
      '旧的二句。',
      '新的文本。',
    ])
  })
})

describe('useSpeechOutput stop 与 speaking 生命周期', () => {
  it('正常：stop 清空缓冲、cancel 朗读并使 speaking 回 false', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('完整句。半句')
    expect(exposed.speaking.value).toBe(true)

    exposed.stop()
    expect(exposed.speaking.value).toBe(false)
    expect(synth.cancel).toHaveBeenCalledTimes(1)

    // 缓冲已被清空：后续 chunk 不与残留的 '半句' 拼接
    exposed.feedChunk('新句。尾部')
    expect(synth.queue.map((u) => u.text)).toEqual(['完整句。', '新句。'])
  })

  it('正常：toggle 只切开关，不打断已入队的朗读', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('朗读中的一句。后面')
    expect(exposed.speaking.value).toBe(true)

    exposed.toggle()
    expect(synth.cancel).toHaveBeenCalledTimes(0)
    expect(exposed.speaking.value).toBe(true)

    flushSpeaking()
    expect(exposed.speaking.value).toBe(false)
  })

  it('正常：speaking 随每句 onend 递减，全部结束回 false', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('第一句。第二句。还有下文')
    expect(synth.queue.length).toBe(2)
    expect(exposed.speaking.value).toBe(true)

    synth.queue[0].onend?.()
    expect(exposed.speaking.value).toBe(true)

    synth.queue[1].onend?.()
    expect(exposed.speaking.value).toBe(false)
  })

  it('边界：句子 onerror 同样递减朗读计数', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('第一句。第二句。还有下文')
    expect(synth.queue.length).toBe(2)

    synth.queue[0].onerror?.(new Event('error'))
    expect(exposed.speaking.value).toBe(true)

    synth.queue[1].onerror?.(new Event('error'))
    expect(exposed.speaking.value).toBe(false)
  })
})

describe('useSpeechOutput voice 选择', () => {
  it('正常：voices 未加载时只设 lang 不设 voice，voiceschanged 后重新 pick 命中', () => {
    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()
    const synth = mockSpeechSynthesis()

    exposed.feedChunk('第一句。尾')
    expect(synth.queue[0].voice).toBeNull()
    expect(synth.queue[0].lang).toBe('zh-CN')

    synth.voices = [
      { lang: 'en-US', name: 'Sam' },
      { lang: 'zh-CN', name: '婷婷' },
    ]
    synth.dispatchEvent(new Event('voiceschanged'))

    exposed.feedChunk('第二句。尾')
    expect(synth.queue[1].voice).toEqual({ lang: 'zh-CN', name: '婷婷' })
    expect(synth.queue[1].lang).toBe('zh-CN')
  })

  it('正常：实例创建时 voices 已就绪则首句直接带 voice', () => {
    const synth = mockSpeechSynthesis()
    synth.voices = [{ lang: 'zh-CN', name: '婷婷' }]

    const { exposed } = mountWithSpeechOutput()
    exposed.toggle()

    exposed.feedChunk('第一句。尾')
    expect(synth.queue[0].voice).toEqual({ lang: 'zh-CN', name: '婷婷' })
  })

  it('正常：voice 按主子标签前缀匹配，zh-CN 也可命中 zh-TW 的 voice', () => {
    const synth = mockSpeechSynthesis()
    synth.voices = [
      { lang: 'zh-TW', name: 'MeiJia' },
      { lang: 'en-US', name: 'Sam' },
    ]

    const { exposed } = mountWithSpeechOutput({ lang: 'zh-CN' })
    exposed.toggle()

    exposed.feedChunk('一句话。尾')
    expect(synth.queue[0].voice).toEqual({ lang: 'zh-TW', name: 'MeiJia' })
    expect(synth.queue[0].lang).toBe('zh-CN')
  })

  it('正常：自定义 lang 时前缀匹配与 utterance.lang 跟随该值', () => {
    const synth = mockSpeechSynthesis()
    synth.voices = [
      { lang: 'zh-CN', name: '婷婷' },
      { lang: 'en-GB', name: 'Daniel' },
    ]

    const { exposed } = mountWithSpeechOutput({ lang: 'en-US' })
    exposed.toggle()

    exposed.feedChunk('你好。尾')
    expect(synth.queue[0].voice).toEqual({ lang: 'en-GB', name: 'Daniel' })
    expect(synth.queue[0].lang).toBe('en-US')
  })
})

describe('useSpeechOutput 卸载清理', () => {
  it('正常：作用域销毁时 cancel 朗读并移除 voiceschanged 监听', () => {
    const synth = mockSpeechSynthesis()
    synth.voices = [{ lang: 'zh-CN', name: '婷婷' }]

    const { wrapper, exposed } = mountWithSpeechOutput()
    exposed.toggle()
    exposed.feedChunk('第一句。尾')
    expect(exposed.speaking.value).toBe(true)
    expect(synth.cancel).toHaveBeenCalledTimes(0)

    wrapper.unmount()
    expect(synth.cancel).toHaveBeenCalledTimes(1)

    // 监听已移除：卸载后 voices 变化不再触发重 pick，后续入队仍用旧 voice
    synth.voices = [{ lang: 'zh-CN', name: '小刚' }]
    synth.dispatchEvent(new Event('voiceschanged'))

    exposed.feedChunk('第二句。尾')
    expect(synth.queue[1].voice).toEqual({ lang: 'zh-CN', name: '婷婷' })
  })
})
