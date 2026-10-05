import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useSpeechInput } from '../../src/composables/useSpeechInput'
import {
  MockSpeechRecognition,
  recognitionEvent,
} from '../../../../tests/mocks/speech'

/**
 * 双盲分工测试：预期值只来自 docs/guide/speech.md「useSpeechInput」行为契约与类型定义，
 * 未参考实现源码。识别实例行为由 tests/mocks/speech.ts 的 mock 承载，回调时机由本测试手动驱动。
 */

/** 取出第 index 个已创建的 mock 实例，不存在即测试前置失败 */
function getInstance(index: number): MockSpeechRecognition {
  const instance = MockSpeechRecognition.instances[index]
  if (!instance) throw new Error(`测试前置失败：instances[${index}] 不存在`)
  return instance
}

/** 在组件 setup 内调用 useSpeechInput，暴露返回值以便测作用域销毁 */
function mountWithSpeechInput() {
  let exposed!: ReturnType<typeof useSpeechInput>
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = useSpeechInput()
        return () => null
      },
    }),
  )
  return { wrapper, exposed }
}

afterEach(() => {
  MockSpeechRecognition.instances.length = 0
  vi.restoreAllMocks()
})

describe('useSpeechInput 特性检测', () => {
  it('正常：mock 注入后 SpeechRecognition 存在，supported 为 true', () => {
    const { supported } = useSpeechInput()

    expect(supported).toBe(true)
  })

  it('异常：两个构造器都缺失时 supported 为 false，start() 不抛异常只置 error 且 status 保持 idle', () => {
    const w = window as unknown as Record<string, unknown>
    const savedRecognition = w.SpeechRecognition
    const savedWebkit = w.webkitSpeechRecognition
    delete w.SpeechRecognition
    delete w.webkitSpeechRecognition
    try {
      const speech = useSpeechInput()

      expect(speech.supported).toBe(false)
      expect(() => speech.start()).not.toThrow()
      expect(speech.error.value).toBe('unsupported')
      expect(speech.status.value).toBe('idle')
    } finally {
      w.SpeechRecognition = savedRecognition
      w.webkitSpeechRecognition = savedWebkit
    }
  })
})

describe('useSpeechInput 状态机与实例配置', () => {
  it('正常：start() 以默认配置创建实例并启动，status 进入 recording', () => {
    const speech = useSpeechInput()

    speech.start()

    expect(MockSpeechRecognition.instances.length).toBe(1)
    const instance = getInstance(0)
    expect(instance.lang).toBe('zh-CN')
    expect(instance.interimResults).toBe(true)
    expect(instance.continuous).toBe(false)
    expect(instance.start).toHaveBeenCalledTimes(1)
    expect(speech.status.value).toBe('recording')
    expect(speech.isRecording.value).toBe(true)
  })

  it('正常：options.lang 写入实例 lang，覆盖默认值', () => {
    const speech = useSpeechInput({ lang: 'en-US' })

    speech.start()

    expect(getInstance(0).lang).toBe('en-US')
  })

  it('正常：stop() 调用实例 stop 进入 recognizing，onend 后回到 idle 且 isRecording 变 false', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)

    speech.stop()

    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(speech.status.value).toBe('recognizing')
    expect(speech.isRecording.value).toBe(true)

    instance.onend?.()

    expect(speech.status.value).toBe('idle')
    expect(speech.isRecording.value).toBe(false)
  })

  it('正常：连续 onresult 回调按序拼接所有 results 更新 interimText', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)

    instance.onresult?.(recognitionEvent('你好'))

    expect(speech.interimText.value).toBe('你好')

    instance.onresult?.(recognitionEvent('你', '好', '世界'))

    expect(speech.interimText.value).toBe('你好世界')
  })

  it('边界：start() 清空上一轮残留的 interimText 与 error', () => {
    const speech = useSpeechInput()
    speech.start()
    const first = getInstance(0)
    first.onerror?.({ error: 'not-allowed' })
    first.onresult?.(recognitionEvent('残留'))
    first.onend?.()
    expect(speech.error.value).toBe('not-allowed')
    expect(speech.interimText.value).toBe('残留')

    speech.start()

    expect(MockSpeechRecognition.instances.length).toBe(2)
    expect(speech.interimText.value).toBe('')
    expect(speech.error.value).toBe('')
  })

  it('边界：onend 后 interimText 保留，供调用方落进输入框', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)
    instance.onresult?.(recognitionEvent('你好'))

    instance.onend?.()

    expect(speech.status.value).toBe('idle')
    expect(speech.interimText.value).toBe('你好')
  })

  it('边界：从未 start 时 stop() 不创建实例，状态保持 idle', () => {
    const speech = useSpeechInput()

    speech.stop()

    expect(MockSpeechRecognition.instances.length).toBe(0)
    expect(speech.status.value).toBe('idle')
  })

  it('边界：会话已结束（onend 回 idle）后 stop() 不唤醒旧实例', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)
    instance.onend?.()
    expect(speech.status.value).toBe('idle')

    speech.stop()

    expect(speech.status.value).toBe('idle')
    expect(instance.stop).not.toHaveBeenCalled()
  })
})

describe('useSpeechInput toggle 切换式录音', () => {
  it('正常：idle 时 toggle() 等价 start，创建实例并进入 recording', () => {
    const speech = useSpeechInput()

    speech.toggle()

    expect(MockSpeechRecognition.instances.length).toBe(1)
    expect(getInstance(0).start).toHaveBeenCalledTimes(1)
    expect(speech.status.value).toBe('recording')
  })

  it('正常：录音中 toggle() 等价 stop，调用实例 stop 进入 recognizing', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)

    speech.toggle()

    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(speech.status.value).toBe('recognizing')
  })
})

describe('useSpeechInput 错误路径', () => {
  it('异常：onerror 把浏览器错误码写入 error', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)

    instance.onerror?.({ error: 'no-speech' })

    expect(speech.error.value).toBe('no-speech')
  })

  it('异常：onerror 之后 onend 仍是回 idle 的唯一路径', () => {
    const speech = useSpeechInput()
    speech.start()
    const instance = getInstance(0)

    instance.onerror?.({ error: 'network' })
    expect(speech.status.value).toBe('recording')

    instance.onend?.()

    expect(speech.status.value).toBe('idle')
  })
})

describe('useSpeechInput 重复 start() 丢弃旧会话', () => {
  it('边界：录音中再次 start() 时旧实例回调不再影响状态，新实例以正确配置启动', () => {
    const speech = useSpeechInput()
    speech.start()
    const oldInstance = getInstance(0)
    oldInstance.onresult?.(recognitionEvent('第一次'))
    expect(speech.interimText.value).toBe('第一次')

    speech.start()

    expect(MockSpeechRecognition.instances.length).toBe(2)
    const newInstance = getInstance(1)
    expect(newInstance.lang).toBe('zh-CN')
    expect(newInstance.interimResults).toBe(true)
    expect(newInstance.continuous).toBe(false)
    expect(newInstance.start).toHaveBeenCalledTimes(1)
    expect(speech.status.value).toBe('recording')
    expect(speech.interimText.value).toBe('')

    oldInstance.onend?.()
    expect(speech.status.value).toBe('recording')

    oldInstance.onresult?.(recognitionEvent('旧会话'))
    expect(speech.interimText.value).toBe('')
  })
})

describe('useSpeechInput 作用域销毁清理', () => {
  it('正常：组件卸载时对活动实例调用 abort 释放麦克风', () => {
    const { wrapper, exposed } = mountWithSpeechInput()
    exposed.start()
    const instance = getInstance(0)

    wrapper.unmount()

    expect(instance.abort).toHaveBeenCalledTimes(1)
  })

  it('正常：卸载后旧实例的 onend 不再把 status 拉回 idle', () => {
    const { wrapper, exposed } = mountWithSpeechInput()
    exposed.start()
    const instance = getInstance(0)
    expect(exposed.status.value).toBe('recording')

    wrapper.unmount()

    instance.onend?.()

    expect(exposed.status.value).toBe('recording')
  })

  it('正常：卸载后旧实例的 onresult/onerror 不再写入 interimText 与 error', () => {
    const { wrapper, exposed } = mountWithSpeechInput()
    exposed.start()
    const instance = getInstance(0)

    wrapper.unmount()

    instance.onresult?.(recognitionEvent('卸载后'))
    instance.onerror?.({ error: 'not-allowed' })

    expect(exposed.interimText.value).toBe('')
    expect(exposed.error.value).toBe('')
  })
})
