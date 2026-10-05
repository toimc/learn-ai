import { describe, expect, it, vi, beforeAll, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MessageActionSpeak from '../../../src/message/actions/MessageActionSpeak.vue'
import { setAiChatLocale } from '../../../src/locales'
import {
  mockSpeechSynthesis,
  flushSpeaking,
} from '../../../../../tests/mocks/speech'

describe('MessageActionSpeak', () => {
  beforeAll(() => setAiChatLocale('zh-CN', { persist: false }))
  afterEach(() => {
    mockSpeechSynthesis().cancel.mockReset()
    mockSpeechSynthesis().speak.mockClear()
    mockSpeechSynthesis().queue.length = 0
  })

  it('默认渲染朗读按钮，tooltip 为「朗读」', () => {
    const w = mount(MessageActionSpeak, { props: { text: '你好。世界。' } })
    expect(w.get('button').attributes('title')).toBe('朗读')
  })

  it('点击后朗读传入文本：utterance 进队且 tooltip 变「停止朗读」', async () => {
    const synth = mockSpeechSynthesis()
    const w = mount(MessageActionSpeak, { props: { text: '今天天气不错。' } })

    await w.get('button').trigger('click')

    expect(synth.queue.length).toBe(1)
    expect(synth.queue[0]!.text).toBe('今天天气不错。')
    expect(w.get('button').attributes('title')).toBe('停止朗读')
  })

  it('多句文本按句拆分入队', async () => {
    const synth = mockSpeechSynthesis()
    const w = mount(MessageActionSpeak, {
      props: { text: '第一句。第二句？尾句没标点' },
    })

    await w.get('button').trigger('click')

    // 两个完整句 + 尾部残句（speak 契约：残句也朗读）
    expect(synth.queue.map((u) => u.text)).toEqual([
      '第一句。',
      '第二句？',
      '尾句没标点',
    ])
  })

  it('朗读中再点停止：cancel 调用且 tooltip 回「朗读」', async () => {
    const synth = mockSpeechSynthesis()
    const w = mount(MessageActionSpeak, { props: { text: '朗读中的内容。' } })

    await w.get('button').trigger('click')
    await w.get('button').trigger('click')

    expect(synth.cancel).toHaveBeenCalled()
    expect(w.get('button').attributes('title')).toBe('朗读')
  })

  it('上一轮读完后换文本可重新朗读', async () => {
    const synth = mockSpeechSynthesis()
    const w = mount(MessageActionSpeak, {
      props: { text: '第一段内容。' },
    })
    await w.get('button').trigger('click')
    expect(synth.queue.map((u) => u.text)).toEqual(['第一段内容。'])

    // 模拟本轮朗读完毕：utterance onend 全部触发，按钮回「朗读」态
    flushSpeaking()
    await nextTick()
    expect(w.get('button').attributes('title')).toBe('朗读')

    await w.setProps({ text: '新一段内容。' })
    await w.get('button').trigger('click')
    expect(synth.queue.map((u) => u.text)).toEqual(['新一段内容。'])
  })

  it('空文本点击不入队（无可朗读内容）', async () => {
    const synth = mockSpeechSynthesis()
    const w = mount(MessageActionSpeak, { props: { text: '' } })

    await w.get('button').trigger('click')

    expect(synth.queue.length).toBe(0)
    expect(w.get('button').attributes('title')).toBe('朗读')
  })

  it('tooltip props 覆盖默认文案', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mount(MessageActionSpeak, {
      props: { text: 'x', tooltip: '读出来', speakingTooltip: '闭嘴' },
    })
    expect(w.get('button').attributes('title')).toBe('读出来')
    await w.get('button').trigger('click')
    expect(w.get('button').attributes('title')).toBe('闭嘴')
    vi.mocked(console.warn).mockRestore()
  })
})
