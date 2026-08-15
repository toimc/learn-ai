import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ImageLightbox from './ImageLightbox.vue'
import type { Attachment } from '@ai-chat/core'

const images: Attachment[] = [
  {
    id: 'a1',
    url: 'https://example.com/cat.png',
    name: '猫.png',
    mediaType: 'image/png',
  },
  {
    id: 'a2',
    url: 'https://example.com/dog.png',
    name: '狗.png',
    mediaType: 'image/png',
  },
]

function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function mountLightbox(props: { attachments: Attachment[]; index?: number }) {
  return mount(ImageLightbox, {
    props,
    global: { stubs: { teleport: true } },
  })
}

describe('ImageLightbox 渲染', () => {
  it('渲染当前 index 图片与计数（2 / 2）', () => {
    const w = mountLightbox({ attachments: images, index: 1 })
    expect(w.get('.ai-chat-lightbox__image').attributes('src')).toBe(
      'https://example.com/dog.png',
    )
    expect(w.get('.ai-chat-lightbox__count').text()).toBe('2 / 2')
  })
})

describe('ImageLightbox 关闭', () => {
  it('Esc（window keydown）→ emit close', async () => {
    const w = mountLightbox({ attachments: images })
    pressKey('Escape')
    await nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点击遮罩（overlay @click.self）→ emit close', async () => {
    const w = mountLightbox({ attachments: images })
    await w.get('.ai-chat-lightbox__overlay').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('ImageLightbox 导航', () => {
  it('→ 下一张、末尾回绕到第一张', async () => {
    const w = mountLightbox({ attachments: images })
    pressKey('ArrowRight')
    await nextTick()
    expect(w.get('.ai-chat-lightbox__image').attributes('src')).toBe(
      'https://example.com/dog.png',
    )
    pressKey('ArrowRight')
    await nextTick()
    expect(w.get('.ai-chat-lightbox__image').attributes('src')).toBe(
      'https://example.com/cat.png',
    )
  })

  it('← 上一张、开头回绕到最后一张', async () => {
    const w = mountLightbox({ attachments: images })
    pressKey('ArrowLeft')
    await nextTick()
    expect(w.get('.ai-chat-lightbox__image').attributes('src')).toBe(
      'https://example.com/dog.png',
    )
  })
})

describe('ImageLightbox 响应式与清理', () => {
  it('index prop 变化时 current 跟随（watch）', async () => {
    const w = mountLightbox({ attachments: images })
    await w.setProps({ index: 1 })
    expect(w.get('.ai-chat-lightbox__image').attributes('src')).toBe(
      'https://example.com/dog.png',
    )
  })

  it('unmount 不报错（监听清理）', () => {
    const w = mountLightbox({ attachments: images })
    expect(() => w.unmount()).not.toThrow()
    // 卸载后按键不再触发 close
    pressKey('Escape')
  })
})
