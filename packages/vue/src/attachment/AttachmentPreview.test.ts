import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AttachmentPreview from './AttachmentPreview.vue'
import type { Attachment } from '@ai-chat/core'

function mountPreview(data: Partial<Attachment> = {}) {
  return mount(AttachmentPreview, {
    global: {
      provide: {
        attachmentData: {
          id: 'a1',
          name: 'cat.png',
          mediaType: 'image/png',
          url: 'blob:a1',
          size: 1024,
          ...data,
        } satisfies Attachment,
      },
    },
  })
}

describe('AttachmentPreview', () => {
  it('图片附件渲染 img，点击 emit preview', async () => {
    const w = mountPreview()
    const img = w.get('img')
    expect(img.attributes('src')).toBe('blob:a1')
    expect(img.attributes('alt')).toBe('cat.png')

    await img.trigger('click')
    expect(w.emitted('preview')).toHaveLength(1)
  })

  it('非图片附件渲染共享图标占位，不 emit preview', async () => {
    const w = mountPreview({
      name: 'doc.pdf',
      mediaType: 'application/pdf',
      url: '',
    })
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('📄')

    await w.get('.ai-chat-attachment-preview__icon').trigger('click')
    expect(w.emitted('preview')).toBeUndefined()
  })
})
