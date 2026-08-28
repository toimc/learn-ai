import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInputUploadButton from '../../src/prompt-input/PromptInputUploadButton.vue'
import {
  PROMPT_INPUT_KEY,
  type PromptInputContext,
} from '../../src/prompt-input/context'

function png(name = 'a.png', size = 1024) {
  return new File([new ArrayBuffer(size)], name, { type: 'image/png' })
}

type AddFilesFn = (files: File[] | FileList) => void

function mountUpload(
  opts: {
    kind?: 'image' | 'file'
    disabled?: boolean
    multiple?: boolean
    accept?: string
    addFiles?: AddFilesFn
  } = {},
): { w: VueWrapper; addFiles: AddFilesFn } {
  const addFiles: AddFilesFn = opts.addFiles ?? vi.fn()
  const ctx: PromptInputContext = {
    inputText: ref(''),
    pendingFiles: ref([]),
    status: ref('ready'),
    disabled: () => opts.disabled ?? false,
    maxHeight: () => 200,
    placeholder: () => '输入消息',
    addFiles,
    remove: vi.fn(),
    sendKey: () => 'alt-enter',
    multiple: () => opts.multiple ?? false,
    accept: () => opts.accept ?? '',
    submit: () => Promise.resolve(),
  }
  const w = mount(PromptInputUploadButton, {
    props: opts.kind ? { kind: opts.kind } : {},
    global: {
      provide: { [PROMPT_INPUT_KEY as symbol]: ctx },
    },
  })
  return { w, addFiles }
}

function input(w: VueWrapper) {
  return w.find('input[type="file"]').element as HTMLInputElement
}

function changeWithFiles(el: HTMLInputElement, files: File[]) {
  Object.defineProperty(el, 'files', { value: files, configurable: true })
  el.dispatchEvent(new Event('change'))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PromptInputUploadButton accept 属性', () => {
  it("kind='image' 时 input accept='image/*'", () => {
    const { w } = mountUpload({ kind: 'image' })
    expect(input(w).accept).toBe('image/*')
  })

  it("kind='file'（默认）时 accept 跟随 context 的 accept()", () => {
    const { w } = mountUpload({ accept: '.pdf,.doc' })
    expect(input(w).accept).toBe('.pdf,.doc')
  })

  it('context accept 为空时移除 accept 属性（不限文件类型）', () => {
    const { w } = mountUpload()
    expect(input(w).hasAttribute('accept')).toBe(false)
  })
})

describe('PromptInputUploadButton multiple', () => {
  it('input multiple 跟随 context', () => {
    const { w } = mountUpload({ multiple: true })
    expect(input(w).multiple).toBe(true)
  })

  it('context multiple 为 false 时 input 不允许多选', () => {
    const { w } = mountUpload()
    expect(input(w).multiple).toBe(false)
  })
})

describe('PromptInputUploadButton 点击选择文件', () => {
  it('点击按钮触发内部 input.click()', async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})
    const { w } = mountUpload()
    await w.find('button').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy.mock.instances[0]).toBe(input(w))
  })

  it('input 与 button 为兄弟节点：一次用户点击 pick 只执行一次（不 mock click）', async () => {
    // 不替换 click 实现：若 input 嵌在 button 内，input.click() 会冒泡回
    // button 再次触发 pick（jsdom 无浏览器 click-in-progress 重入保护，会递归）
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    const { w } = mountUpload()
    const btn = w.find('button')
    const btnClicks = vi.fn()
    btn.element.addEventListener('click', btnClicks)

    await btn.trigger('click')

    expect(btnClicks).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('button 有与 title 同值的 aria-label', () => {
    const { w } = mountUpload({ kind: 'image' })
    const btn = w.find('button')
    expect(btn.attributes('aria-label')).toBe('上传图片')
    expect(btn.attributes('title')).toBe('上传图片')
  })

  it('change 后 addFiles 收到文件数组、input.value 清空（连续选同一文件可再次触发）', () => {
    const { w, addFiles } = mountUpload({ multiple: true })
    const el = input(w)
    const file = png()

    changeWithFiles(el, [file])
    expect(addFiles).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith([file])
    expect(el.value).toBe('')

    changeWithFiles(el, [file])
    expect(addFiles).toHaveBeenCalledTimes(2)
  })

  it('change 无文件时不调用 addFiles', () => {
    const { w, addFiles } = mountUpload()
    input(w).dispatchEvent(new Event('change'))
    expect(addFiles).not.toHaveBeenCalled()
  })
})

describe('PromptInputUploadButton disabled', () => {
  it('disabled 时按钮禁用且点击不触发文件选择', async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})
    const { w } = mountUpload({ disabled: true })
    const btn = w.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
