import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import InputArea from './InputArea.vue'
import { setAiChatLocale } from './locales'

/** @deprecated 组件：PromptInput 已有完整测试，此处只做向后兼容的行为冒烟 */
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

function mountInputArea(
  props: { disabled?: boolean; placeholder?: string } = {},
) {
  return mount(InputArea, { props })
}

async function typeAndSubmit(
  w: ReturnType<typeof mountInputArea>,
  text: string,
) {
  await w.get('textarea').setValue(text)
  await w.get('textarea').trigger('keydown.enter')
}

describe('InputArea 发送行为（@deprecated 冒烟）', () => {
  it('正常：输入内容按 Enter 发送并清空输入框', async () => {
    const w = mountInputArea()
    await typeAndSubmit(w, '你好')
    expect(w.emitted('send')).toEqual([['你好']])
    expect(w.get('textarea').element.value).toBe('')
  })

  it('正常：点击发送按钮同样触发 send', async () => {
    const w = mountInputArea()
    await w.get('textarea').setValue('内容')
    await w.get('.ai-chat-input__btn').trigger('click')
    expect(w.emitted('send')).toEqual([['内容']])
  })

  it('边界：空内容不发送', async () => {
    const w = mountInputArea()
    await typeAndSubmit(w, '')
    expect(w.emitted('send')).toBeUndefined()
  })

  it('边界：纯空白内容 trim 后不发送', async () => {
    const w = mountInputArea()
    await typeAndSubmit(w, '   ')
    expect(w.emitted('send')).toBeUndefined()
  })

  it('正常：发送的内容是 trim 后的文本', async () => {
    const w = mountInputArea()
    await typeAndSubmit(w, '  hello  ')
    expect(w.emitted('send')).toEqual([['hello']])
  })

  it('异常：disabled 时 Enter 不发送，展示停止按钮并 emit abort', async () => {
    const w = mountInputArea({ disabled: true })
    await typeAndSubmit(w, '内容')
    expect(w.emitted('send')).toBeUndefined()

    const stopBtn = w.get('.ai-chat-input__btn--abort')
    expect(stopBtn.text()).toBe('停止')
    await stopBtn.trigger('click')
    expect(w.emitted('abort')).toHaveLength(1)
  })

  it('边界：自定义 placeholder 覆盖默认文案', () => {
    const w = mountInputArea({ placeholder: '随便问点什么' })
    expect(w.get('textarea').attributes('placeholder')).toBe('随便问点什么')
  })

  it('边界：placeholder 缺省时使用 i18n 默认文案', () => {
    const w = mountInputArea()
    expect(w.get('textarea').attributes('placeholder')).toBe('输入消息...')
  })
})
