import { describe, it, expect } from 'vitest'
import {
  getFileIcon,
  getMediaCategory,
  getAttachmentLabel,
} from '../../src/utils/media'

describe('getFileIcon', () => {
  it('document / audio / video / image 四类各自命中映射', () => {
    expect(getFileIcon('application/pdf')).toBe('📄')
    expect(getFileIcon('audio/mpeg')).toBe('🎵')
    expect(getFileIcon('video/mp4')).toBe('🎬')
    expect(getFileIcon('image/png')).toBe('📄')
  })

  it('未知类型 fallback 统一为 📄', () => {
    expect(getFileIcon('')).toBe('📄')
    expect(getFileIcon('foo/bar')).toBe('📄')
  })
})

describe('getMediaCategory', () => {
  it('按前缀分类，未知归 document', () => {
    expect(getMediaCategory('image/jpeg')).toBe('image')
    expect(getMediaCategory('video/webm')).toBe('video')
    expect(getMediaCategory('audio/ogg')).toBe('audio')
    expect(getMediaCategory('text/plain')).toBe('document')
    expect(getMediaCategory('')).toBe('document')
  })
})

describe('getAttachmentLabel', () => {
  it('已知 mime 命中缩写，未知取子类型大写', () => {
    expect(getAttachmentLabel('application/pdf')).toBe('PDF')
    expect(getAttachmentLabel('text/plain')).toBe('TXT')
    expect(getAttachmentLabel('application/octet-stream')).toBe('OCTET-STREAM')
  })
})
