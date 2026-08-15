import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInputTextarea from './PromptInputTextarea.vue'
import { PROMPT_INPUT_KEY, type PromptInputContext } from './context'

function png(name = 'a.png', size = 1024) {
  return new File([new ArrayBuffer(size)], name, { type: 'image/png' })
}

type AddFilesFn = (files: File[] | FileList) => void

function mountTextarea(
  opts: {
    sendKey?: 'alt-enter' | 'enter'
    addFiles?: AddFilesFn
  } = {},
): { w: VueWrapper; submit: ReturnType<typeof vi.fn>; addFiles: AddFilesFn } {
  const submit = vi.fn()
  const addFiles: AddFilesFn = opts.addFiles ?? vi.fn()
  const ctx: PromptInputContext = {
    inputText: ref(''),
    pendingFiles: ref([]),
    status: ref('ready'),
    disabled: () => false,
    maxHeight: () => 200,
    placeholder: () => '输入消息',
    addFiles,
    remove: vi.fn(),
    sendKey: () => opts.sendKey ?? 'alt-enter',
    multiple: () => true,
    accept: () => '',
    submit: vi.fn(),
  }
  const w = mount(PromptInputTextarea, {
    global: {
      provide: {
        [PROMPT_INPUT_KEY as symbol]: ctx,
        promptSubmit: submit,
      },
    },
  })
  return { w, submit, addFiles }
}

function keydown(
  el: HTMLTextAreaElement,
  mods: { alt?: boolean; meta?: boolean; shift?: boolean },
) {
  const evt = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    altKey: !!mods.alt,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
  })
  el.dispatchEvent(evt)
  return evt
}

function paste(el: HTMLTextAreaElement, clipboardData: unknown) {
  const evt = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(evt, 'clipboardData', { value: clipboardData })
  el.dispatchEvent(evt)
  return evt
}

function textarea(w: VueWrapper) {
  return w.find('textarea').element as HTMLTextAreaElement
}

describe('PromptInputTextarea sendKey=alt-enter（默认）', () => {
  it('Enter 不提交（原生换行）', () => {
    const { w, submit } = mountTextarea()
    const evt = keydown(textarea(w), {})
    expect(submit).not.toHaveBeenCalled()
    expect(evt.defaultPrevented).toBe(false)
  })

  it('Alt+Enter 提交', () => {
    const { w, submit } = mountTextarea()
    const evt = keydown(textarea(w), { alt: true })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(evt.defaultPrevented).toBe(true)
  })

  it('Meta+Enter（macOS Cmd）提交', () => {
    const { w, submit } = mountTextarea()
    const evt = keydown(textarea(w), { meta: true })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(evt.defaultPrevented).toBe(true)
  })

  it('Shift+Enter 不提交', () => {
    const { w, submit } = mountTextarea()
    keydown(textarea(w), { shift: true })
    expect(submit).not.toHaveBeenCalled()
  })

  it('Shift+Alt+Enter 也不提交（发送键要求无 shift）', () => {
    const { w, submit } = mountTextarea()
    keydown(textarea(w), { alt: true, shift: true })
    expect(submit).not.toHaveBeenCalled()
  })
})

describe('PromptInputTextarea sendKey=enter（传统模式）', () => {
  it('Enter 提交，Shift+Enter 不提交（累计 1 次）', () => {
    const { w, submit } = mountTextarea({ sendKey: 'enter' })
    const evt = keydown(textarea(w), {})
    expect(submit).toHaveBeenCalledTimes(1)
    expect(evt.defaultPrevented).toBe(true)

    keydown(textarea(w), { shift: true })
    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('PromptInputTextarea 粘贴', () => {
  it('剪贴板含文件：拦截并 addFiles 收到文件数组', () => {
    const { w, addFiles } = mountTextarea()
    const file = png()
    const evt = paste(textarea(w), { files: [file] })
    expect(evt.defaultPrevented).toBe(true)
    expect(addFiles).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith([file])
  })

  it('纯文本粘贴：不调用 addFiles、不 preventDefault', () => {
    const { w, addFiles } = mountTextarea()
    const evt = paste(textarea(w), { files: [] })
    expect(evt.defaultPrevented).toBe(false)
    expect(addFiles).not.toHaveBeenCalled()
  })
})
