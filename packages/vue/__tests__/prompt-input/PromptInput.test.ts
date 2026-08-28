import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, inject } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInput from '../../src/prompt-input/PromptInput.vue'
import {
  PROMPT_INPUT_KEY,
  type PromptInputContext,
} from '../../src/prompt-input/context'
import type { Attachment } from '@toimc/core'

function png(name = 'a.png', size = 1024) {
  return new File([new ArrayBuffer(size)], name, { type: 'image/png' })
}

const attachment: Attachment = {
  id: 'att-1',
  url: 'https://example.com/a.png',
  name: 'a.png',
  mediaType: 'image/png',
  size: 1024,
}

/** probe 模式：通过 default slot 内的探针组件拿到 provide 出来的上下文 */
let ctx: PromptInputContext
const Probe = defineComponent({
  setup() {
    ctx = inject(PROMPT_INPUT_KEY)!
    return () => null
  },
})

function mountInput(props: Record<string, unknown> = {}): VueWrapper {
  ctx = undefined as unknown as PromptInputContext
  return mount(PromptInput, {
    props,
    slots: { default: () => h(Probe) },
  })
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('PromptInput', () => {
  it('渲染 disclaimer 默认文案', () => {
    const w = mountInput()
    expect(w.find('.ai-chat-prompt-input__disclaimer').exists()).toBe(true)
    expect(w.text()).toContain('AI Chat UI')
  })

  it('disclaimer slot 可覆盖', () => {
    const w = mount(PromptInput, {
      slots: { disclaimer: '自定义提示' },
    })
    expect(w.text()).toContain('自定义提示')
  })

  it('footer 具名插槽渲染在 wrapper 内（default 插槽之后）', () => {
    const w = mount(PromptInput, {
      slots: {
        default: () => h('div', { class: 'slot-default' }, 'D'),
        footer: () => h('div', { class: 'slot-footer' }, 'F'),
      },
    })
    const wrapper = w.get('.ai-chat-prompt-input__wrapper')
    expect(wrapper.find('.slot-footer').exists()).toBe(true)
    expect(
      wrapper.findAll('.slot-default, .slot-footer').map((n) => n.classes()[0]),
    ).toEqual(['slot-default', 'slot-footer'])
  })

  it('无文本但有文件时可发送，send 携带 files', async () => {
    const w = mountInput()
    const file = png()
    ctx.addFiles([file])
    ctx.inputText.value = ''
    await ctx.submit()
    expect(w.emitted('send')).toHaveLength(1)
    const payload = w.emitted('send')![0][0] as {
      text: string
      files?: File[]
    }
    expect(payload.text).toBe('')
    expect(payload.files).toEqual([file])
    expect(ctx.pendingFiles.value).toHaveLength(0)
  })

  it('beforeSend 成功：uploading 后 emit send attachments 并清空', async () => {
    const beforeSend = vi.fn().mockResolvedValue([attachment])
    const w = mountInput({ beforeSend })
    const file = png()
    ctx.addFiles([file])
    ctx.inputText.value = '  看图  '

    const pending = ctx.submit()
    expect(ctx.pendingFiles.value[0].status).toBe('uploading')
    expect(w.emitted('send')).toBeUndefined()

    await pending
    expect(beforeSend).toHaveBeenCalledWith([file])
    const payload = w.emitted('send')![0][0] as {
      text: string
      attachments?: Attachment[]
    }
    expect(payload.text).toBe('看图')
    expect(payload.attachments).toEqual([attachment])
    expect(ctx.pendingFiles.value).toHaveLength(0)
    expect(ctx.inputText.value).toBe('')
  })

  it('beforeSend resolve 空数组时 attachments 为 undefined', async () => {
    const beforeSend = vi.fn().mockResolvedValue([])
    const w = mountInput({ beforeSend })
    ctx.addFiles([png()])
    ctx.inputText.value = '看图'
    await ctx.submit()
    const payload = w.emitted('send')![0][0] as { attachments?: Attachment[] }
    expect(payload.attachments).toBeUndefined()
    expect(ctx.pendingFiles.value).toHaveLength(0)
  })

  it('beforeSend 失败：不 emit send，文件标记 error', async () => {
    const beforeSend = vi.fn().mockRejectedValue(new Error('网络错误'))
    const w = mountInput({ beforeSend })
    ctx.addFiles([png()])
    ctx.inputText.value = '看图'

    await ctx.submit()

    expect(w.emitted('send')).toBeUndefined()
    expect(ctx.pendingFiles.value).toHaveLength(1)
    expect(ctx.pendingFiles.value[0].status).toBe('error')
    expect(ctx.pendingFiles.value[0].error).toBe('网络错误')
    expect(w.find('.ai-chat-toast').exists()).toBe(true)
    expect(w.text()).toContain('附件上传失败')
    expect(ctx.inputText.value).toBe('看图')
  })

  it('上传窗口内新增文件与继续输入不被丢弃', async () => {
    let resolveUpload: (v: Attachment[]) => void
    const beforeSend = vi.fn(
      () =>
        new Promise<Attachment[]>((resolve) => {
          resolveUpload = resolve
        }),
    )
    const w = mountInput({ beforeSend })
    const file1 = png('1.png')
    ctx.addFiles([file1])
    ctx.inputText.value = '第一批'

    const pending = ctx.submit()
    // 上传进行中：追加文件 B、继续输入
    const file2 = png('2.png')
    ctx.addFiles([file2])
    ctx.inputText.value = '第一批追加'

    resolveUpload!([attachment])
    await pending

    expect(beforeSend).toHaveBeenCalledTimes(1)
    expect(beforeSend).toHaveBeenCalledWith([file1])
    // 新增文件 B 保留，未参与本次 beforeSend
    expect(ctx.pendingFiles.value).toHaveLength(1)
    expect(ctx.pendingFiles.value[0].file).toBe(file2)
    // 等待期间新敲的字保留
    expect(ctx.inputText.value).toBe('第一批追加')
    expect(w.emitted('send')).toHaveLength(1)
  })

  it('校验拒绝：emit error 并渲染 Toast', async () => {
    const w = mountInput({ maxFiles: 1 })
    const f1 = png('1.png')
    const f2 = png('2.png')
    ctx.addFiles([f1, f2])
    await flush()

    expect(w.emitted('error')).toHaveLength(1)
    const err = w.emitted('error')![0][0] as { files: File[]; reason: string }
    expect(err.files).toEqual([f2])
    expect(err.reason).toContain('数量')
    expect(w.find('.ai-chat-toast').exists()).toBe(true)
    expect(ctx.pendingFiles.value).toHaveLength(1)
  })

  it('uploading 期间 submit 不重复触发 beforeSend', async () => {
    let resolveUpload: (v: Attachment[]) => void
    const beforeSend = vi.fn(
      () =>
        new Promise<Attachment[]>((resolve) => {
          resolveUpload = resolve
        }),
    )
    const w = mountInput({ beforeSend })
    ctx.addFiles([png()])
    ctx.inputText.value = '看图'

    const p1 = ctx.submit()
    await ctx.submit() // uploading 进行中，应直接 return
    expect(beforeSend).toHaveBeenCalledTimes(1)

    resolveUpload!([attachment])
    await p1
    expect(w.emitted('send')).toHaveLength(1)
  })

  it('drop 带文件：经 addFilesAndNotify 管道加入 pendingFiles', async () => {
    const w = mountInput()
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    await wrapper.trigger('drop', {
      dataTransfer: { files: [png()] },
    })
    expect(ctx.pendingFiles.value).toHaveLength(1)
    expect(ctx.pendingFiles.value[0].file.name).toBe('a.png')
  })

  it('dragenter + dragover（Files）后 wrapper 加 dragover 高亮类', async () => {
    const w = mountInput()
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    await wrapper.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
    await wrapper.trigger('dragover', { dataTransfer: { types: ['Files'] } })
    expect(wrapper.classes()).toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )
  })

  it('drop 后高亮类移除', async () => {
    const w = mountInput()
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    await wrapper.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
    await wrapper.trigger('drop', {
      dataTransfer: { files: [png()] },
    })
    expect(wrapper.classes()).not.toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )
  })

  it('dragleave 深度计数归零才熄灭；子元素间移动不误灭', async () => {
    const w = mountInput()
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    const dragenter = () =>
      wrapper.trigger('dragenter', { dataTransfer: { types: ['Files'] } })

    await dragenter()
    await dragenter() // 拖入子元素再 enter 一次
    await wrapper.trigger('dragleave')
    expect(wrapper.classes()).toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )

    await wrapper.trigger('dragleave')
    expect(wrapper.classes()).not.toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )
  })

  it('非 Files 拖拽：不加高亮、drop 不入列表', async () => {
    const w = mountInput()
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    await wrapper.trigger('dragenter', {
      dataTransfer: { types: ['text/plain'] },
    })
    await wrapper.trigger('dragover', {
      dataTransfer: { types: ['text/plain'] },
    })
    expect(wrapper.classes()).not.toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )

    await wrapper.trigger('drop', {
      dataTransfer: { types: ['text/plain'], files: [] },
    })
    expect(ctx.pendingFiles.value).toHaveLength(0)
  })

  it('disabled 时 drop 不入 pendingFiles、不高亮', async () => {
    const w = mountInput({ disabled: true })
    const wrapper = w.find('.ai-chat-prompt-input__wrapper')
    await wrapper.trigger('dragenter', { dataTransfer: { types: ['Files'] } })
    await wrapper.trigger('dragover', { dataTransfer: { types: ['Files'] } })
    expect(wrapper.classes()).not.toContain(
      'ai-chat-prompt-input__wrapper--dragover',
    )

    await wrapper.trigger('drop', {
      dataTransfer: { types: ['Files'], files: [png()] },
    })
    expect(ctx.pendingFiles.value).toHaveLength(0)
  })
})
