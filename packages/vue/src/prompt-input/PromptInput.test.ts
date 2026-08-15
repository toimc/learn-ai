import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInput from './PromptInput.vue'
import type { Attachment } from '@ai-chat/core'
import type { PendingFile } from '../composables/usePendingFiles'

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

/** 读取 PromptInput provide 出来的上下文（含 submit/addFiles/pendingFiles） */
function getCtx(w: VueWrapper) {
  return (w.vm.$ as unknown as { provides: Record<string, unknown> }).provides[
    'promptInput'
  ] as {
    inputText: { value: string }
    pendingFiles: { value: PendingFile[] }
    addFiles: (files: File[] | FileList) => void
    submit: () => Promise<void>
  }
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('PromptInput', () => {
  it('渲染 disclaimer 默认文案', () => {
    const w = mount(PromptInput)
    expect(w.find('.ai-chat-prompt-input__disclaimer').exists()).toBe(true)
    expect(w.text()).toContain('AI Chat UI')
  })

  it('disclaimer slot 可覆盖', () => {
    const w = mount(PromptInput, {
      slots: { disclaimer: '自定义提示' },
    })
    expect(w.text()).toContain('自定义提示')
  })

  it('无文本但有文件时可发送，send 携带 files', async () => {
    const w = mount(PromptInput)
    const ctx = getCtx(w)
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
    const w = mount(PromptInput, {
      props: { beforeSend },
    })
    const ctx = getCtx(w)
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

  it('beforeSend 失败：不 emit send，文件标记 error', async () => {
    const beforeSend = vi.fn().mockRejectedValue(new Error('网络错误'))
    const w = mount(PromptInput, {
      props: { beforeSend },
    })
    const ctx = getCtx(w)
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

  it('校验拒绝：emit error 并渲染 Toast', async () => {
    const w = mount(PromptInput, { props: { maxFiles: 1 } })
    const ctx = getCtx(w)
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
    const w = mount(PromptInput, {
      props: { beforeSend },
    })
    const ctx = getCtx(w)
    ctx.addFiles([png()])
    ctx.inputText.value = '看图'

    const p1 = ctx.submit()
    await ctx.submit() // uploading 进行中，应直接 return
    expect(beforeSend).toHaveBeenCalledTimes(1)

    resolveUpload!([attachment])
    await p1
    expect(w.emitted('send')).toHaveLength(1)
  })
})
