import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Attachment } from '@toimc/core'
import AttachmentShell from './Attachment.vue'
import AttachmentInfo from './AttachmentInfo.vue'

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att_1',
    name: '设计稿.png',
    mediaType: 'image/png',
    size: 1536,
    ...overrides,
  }
}

/** AttachmentInfo 依赖 inject 的 attachmentData（由 Attachment 外壳 provide） */
function mountInfo(data: Attachment) {
  return mount(AttachmentInfo, {
    global: { provide: { attachmentData: data } },
  })
}

describe('Attachment 外壳', () => {
  it('正常：provide 数据并渲染默认 slot', () => {
    const w = mount(AttachmentShell, {
      props: { data: makeAttachment() },
      slots: { default: '<span class="inner">内容</span>' },
    })
    expect(w.classes()).toContain('ai-chat-attachment')
    expect(w.get('.inner').text()).toBe('内容')
  })
})

describe('AttachmentInfo 信息展示', () => {
  it('正常：展示文件名、类型 label 与格式化大小', () => {
    const w = mountInfo(makeAttachment())
    expect(w.get('.ai-chat-attachment-info__name').text()).toBe('设计稿.png')
    const meta = w.get('.ai-chat-attachment-info__meta').text()
    expect(meta).toContain('PNG')
    expect(meta).toContain('1.5 KB')
  })

  it('边界：无 size 时不渲染大小与分隔点', () => {
    const w = mountInfo(makeAttachment({ size: undefined }))
    const meta = w.get('.ai-chat-attachment-info__meta').text()
    expect(meta).not.toContain('·')
    expect(meta).not.toContain('KB')
  })
})
