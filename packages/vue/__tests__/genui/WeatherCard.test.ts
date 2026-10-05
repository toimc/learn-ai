import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import WeatherCard from '../../src/genui/WeatherCard.vue'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

describe('WeatherCard 渲染', () => {
  it('根元素带 ai-chat-weather-card 类，渲染城市/温度/天气描述', () => {
    const w = mount(WeatherCard, {
      props: { city: 'Beijing', temperatureC: 22, description: 'Sunny' },
    })
    expect(w.find('.ai-chat-weather-card').exists()).toBe(true)
    const text = w.get('.ai-chat-weather-card').text()
    expect(text).toContain('Beijing')
    expect(text).toContain('22°C')
    expect(text).toContain('Sunny')
  })

  it('边界：temperatureC=0 显示 0°C（0 是合法温度值而非缺省）', () => {
    const w = mount(WeatherCard, {
      props: { city: 'Reykjavik', temperatureC: 0, description: 'Windy' },
    })
    expect(w.get('.ai-chat-weather-card').text()).toContain('0°C')
  })

  it('负温度显示负号', () => {
    const w = mount(WeatherCard, {
      props: { city: 'Harbin', temperatureC: -8, description: 'Snow' },
    })
    expect(w.get('.ai-chat-weather-card').text()).toContain('-8°C')
  })
})

describe('WeatherCard detail 事件', () => {
  it('点击根元素触发 detail 事件，参数为 city 值', async () => {
    const w = mount(WeatherCard, {
      props: { city: 'Beijing', temperatureC: 22, description: 'Sunny' },
    })
    await w.get('.ai-chat-weather-card').trigger('click')
    expect(w.emitted('detail')).toEqual([['Beijing']])
  })
})
