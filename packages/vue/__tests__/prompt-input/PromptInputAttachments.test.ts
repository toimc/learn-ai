import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PromptInputAttachments from '../../src/prompt-input/PromptInputAttachments.vue'
import ImageLightbox from '../../src/preview/ImageLightbox.vue'
import {
  PROMPT_INPUT_KEY,
  type PromptInputContext,
} from '../../src/prompt-input/context'
import type { PendingFile } from '../../src/composables/usePendingFiles'
import type { Attachment } from '@toimc/core'
import { setAiChatLocale } from '../../src/locales'

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new ArrayBuffer(size)], name, { type })
}

function pending(
  id: string,
  file: File,
  overrides: Partial<PendingFile> = {},
): PendingFile {
  return {
    id,
    file,
    previewUrl: file.type.startsWith('image/') ? `blob:${id}` : '',
    status: 'ready',
    ...overrides,
  }
}

function mountAttachments(
  files: PendingFile[],
  opts: { onPreview?: (payload: unknown) => void } = {},
): { w: VueWrapper; remove: ReturnType<typeof vi.fn> } {
  const remove = vi.fn()
  const ctx: PromptInputContext = {
    inputText: ref(''),
    pendingFiles: ref(files),
    status: ref('ready'),
    disabled: () => false,
    maxHeight: () => 200,
    placeholder: () => '输入消息',
    addFiles: vi.fn(),
    remove,
    sendKey: () => 'alt-enter',
    multiple: () => true,
    accept: () => '',
    submit: () => Promise.resolve(),
  }
  const w = mount(PromptInputAttachments, {
    props: opts.onPreview ? { onPreview: opts.onPreview } : {},
    global: {
      provide: { [PROMPT_INPUT_KEY as symbol]: ctx },
      stubs: { teleport: true },
    },
  })
  return { w, remove }
}

afterEach(() => {
  vi.restoreAllMocks()
  // 组件文案走 aiChatI18n 单例 t()，复位 locale 防止跨文件残留（默认 zh-CN 对齐下方断言）
  setAiChatLocale('zh-CN', { persist: false })
})

describe('PromptInputAttachments 渲染', () => {
  it('空列表时整个区域不渲染', () => {
    const { w } = mountAttachments([])
    expect(w.find('.ai-chat-prompt-attachments').exists()).toBe(false)
  })

  it('渲染图片缩略图、文件名、大小与移除按钮；点击移除调 remove(id)', async () => {
    const file = makeFile('cat.png', 'image/png', 2048)
    const { w, remove } = mountAttachments([pending('p1', file)])
    const item = w.get('.ai-chat-prompt-attachments__item')
    expect(item.find('img').attributes('src')).toBe('blob:p1')
    expect(item.text()).toContain('cat.png')
    expect(item.text()).toContain('2.0 KB')
    expect(w.find('.ai-chat-prompt-attachments__remove').exists()).toBe(true)

    await w.get('.ai-chat-prompt-attachments__remove').trigger('click')
    expect(remove).toHaveBeenCalledWith('p1')
  })

  it('大小格式化覆盖 B / KB / MB', () => {
    const files = [
      pending('p1', makeFile('a.txt', 'text/plain', 500)),
      pending('p2', makeFile('b.png', 'image/png', 1024)),
      pending('p3', makeFile('c.png', 'image/png', 2 * 1024 * 1024)),
    ]
    const { w } = mountAttachments(files)
    const text = w.text()
    expect(text).toContain('500 B')
    expect(text).toContain('1.0 KB')
    expect(text).toContain('2.0 MB')
  })

  it('非图片文件渲染图标占位（不渲染 img）', () => {
    const { w } = mountAttachments([
      pending('d1', makeFile('doc.pdf', 'application/pdf')),
    ])
    const item = w.get('.ai-chat-prompt-attachments__item')
    expect(item.find('img').exists()).toBe(false)
    expect(item.text()).toContain('doc.pdf')
  })
})

describe('PromptInputAttachments 状态标记', () => {
  it('uploading 态条目带 loading 标记（--uploading 修饰类 + loading 遮罩）', () => {
    const files = [
      pending('u1', makeFile('x.png', 'image/png'), { status: 'uploading' }),
    ]
    const { w } = mountAttachments(files)
    expect(
      w.find('.ai-chat-prompt-attachments__item--uploading').exists(),
    ).toBe(true)
    expect(w.find('.ai-chat-prompt-attachments__loading').exists()).toBe(true)
  })

  it('error 态条目带 --error 修饰类，title 含错误信息', () => {
    const files = [
      pending('e1', makeFile('bad.png', 'image/png'), {
        status: 'error',
        error: '上传失败',
      }),
    ]
    const { w } = mountAttachments(files)
    const item = w.get('.ai-chat-prompt-attachments__item--error')
    expect(item.attributes('title')).toContain('上传失败')
  })

  it('a11y：移除按钮 aria-label 含文件名；非图片缩略图不可点击；uploading/error 有 sr-only 状态文本', () => {
    const files = [
      pending('f1', makeFile('note.pdf', 'application/pdf')),
      pending('u1', makeFile('up.png', 'image/png'), { status: 'uploading' }),
      pending('e1', makeFile('err.mp3', 'audio/mpeg'), {
        status: 'error',
        error: '上传失败',
      }),
    ]
    const { w } = mountAttachments(files)
    const items = w.findAll('.ai-chat-prompt-attachments__item')
    expect(
      items[0]
        .get('.ai-chat-prompt-attachments__remove')
        .attributes('aria-label'),
    ).toBe('移除 note.pdf')

    // 非图片项的 thumb 不是 button，图标可见
    expect(
      items[0].get('.ai-chat-prompt-attachments__thumb').element.tagName,
    ).not.toBe('BUTTON')
    expect(items[0].text()).toContain('📄')

    // uploading 项 aria-busy 与状态文本
    expect(items[1].attributes('aria-busy')).toBe('true')
    expect(items[1].find('.ai-chat-sr-only').text()).toBe('上传中')

    // error 项状态文本（非上传态不渲染 aria-busy，避免噪音）
    expect(items[2].attributes('aria-busy')).toBeUndefined()
    expect(items[2].find('.ai-chat-sr-only').text()).toBe('上传失败')
  })
})

describe('PromptInputAttachments 图片预览兜底链', () => {
  const imgs = [
    pending('i1', makeFile('one.png', 'image/png')),
    pending('i2', makeFile('two.png', 'image/png')),
  ]

  it('宿主未监听 preview：点击缩略图打开内置 ImageLightbox，Esc 关闭后消失', async () => {
    const { w } = mountAttachments(imgs)
    expect(w.findComponent(ImageLightbox).exists()).toBe(false)

    await w.findAll('.ai-chat-prompt-attachments__thumb')[1].trigger('click')
    expect(w.findComponent(ImageLightbox).exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.findComponent(ImageLightbox).exists()).toBe(false)
  })

  it('宿主监听 preview：只 emit preview {attachments, index}，不弹内置 Lightbox', async () => {
    const onPreview = vi.fn()
    const { w } = mountAttachments(imgs, { onPreview })
    await w.findAll('.ai-chat-prompt-attachments__thumb')[0].trigger('click')

    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(w.findComponent(ImageLightbox).exists()).toBe(false)
  })

  it('emit 的 attachments 是图片 PendingFile 映射的 Attachment[]，index 指向被点击项', async () => {
    const mixed = [
      pending('f1', makeFile('doc.pdf', 'application/pdf')),
      pending('i1', makeFile('one.png', 'image/png', 100)),
      pending('i2', makeFile('two.png', 'image/png', 200)),
    ]
    const { w } = mountAttachments(mixed, { onPreview: vi.fn() })
    // 点击第二个图片缩略图（跳过非图片项后为第 2 张）
    await w.findAll('.ai-chat-prompt-attachments__thumb')[2].trigger('click')

    const events =
      w.emitted<[{ attachments: Attachment[]; index: number }]>('preview')
    expect(events).toHaveLength(1)
    const { attachments, index } = events![0][0]
    expect(attachments).toEqual([
      {
        id: 'i1',
        name: 'one.png',
        mediaType: 'image/png',
        url: 'blob:i1',
        size: 100,
      },
      {
        id: 'i2',
        name: 'two.png',
        mediaType: 'image/png',
        url: 'blob:i2',
        size: 200,
      },
    ])
    expect(index).toBe(1)
  })

  it('宿主动态添加 onPreview：setProps 后点击走 emit，不再弹内置 Lightbox', async () => {
    const onPreview = vi.fn()
    const { w } = mountAttachments(imgs)

    // 初始未监听：点击打开内置 Lightbox
    await w.findAll('.ai-chat-prompt-attachments__thumb')[0].trigger('click')
    expect(w.findComponent(ImageLightbox).exists()).toBe(true)
    expect(onPreview).not.toHaveBeenCalled()

    // 关闭内置 Lightbox，避免遗留 open 状态干扰后续断言
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    // 宿主动态添加监听：再点击只 emit preview，Lightbox 不再弹出
    await w.setProps({ onPreview })
    await w.findAll('.ai-chat-prompt-attachments__thumb')[0].trigger('click')
    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(w.emitted('preview')).toHaveLength(1)
    expect(w.findComponent(ImageLightbox).exists()).toBe(false)
  })
})
