import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StreamText from './StreamText.vue'

/** watch 无 immediate：初始 props 不渲染，需经 setProps 触发（对齐流式场景） */
describe('StreamText 流式文本', () => {
  it('正常：stream 首次到达时显示文本与光标', async () => {
    const w = mount(StreamText)
    await w.setProps({ stream: '你好' })
    expect(w.get('.ai-chat-stream-text').text()).toContain('你好')
    expect(w.find('.ai-chat-stream-text__cursor').exists()).toBe(true)
  })

  it('正常：stream 持续变化时文本实时更新', async () => {
    const w = mount(StreamText, { props: { stream: 'ab' } })
    await w.setProps({ stream: 'abc' })
    expect(w.get('.ai-chat-stream-text').text()).toContain('abc')
  })

  it('边界：stream 为空串仍显示光标（流刚开始）', async () => {
    const w = mount(StreamText)
    await w.setProps({ stream: '' })
    expect(w.find('.ai-chat-stream-text__cursor').exists()).toBe(true)
  })

  it('异常/终态：stream 变为 undefined 时光标消失，已产出文本保留', async () => {
    const w = mount(StreamText)
    await w.setProps({ stream: '内容' })
    await w.setProps({ stream: undefined })
    expect(w.find('.ai-chat-stream-text__cursor').exists()).toBe(false)
    expect(w.get('.ai-chat-stream-text').text()).toContain('内容')
  })

  it('边界：初始无 props 时文本为空但光标可见（等待流开始）', () => {
    const w = mount(StreamText)
    expect(w.get('.ai-chat-stream-text').text()).toBe('▉')
    expect(w.find('.ai-chat-stream-text__cursor').exists()).toBe(true)
  })
})
