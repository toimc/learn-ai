import { describe, it, expect } from 'vitest'
import {
  DEFAULT_IMAGE_MAX_SIDE,
  DEFAULT_IMAGE_JPEG_QUALITY,
  JPEG_DATA_URL_PREFIX,
  clampImageQuality,
  buildJpegDataUrl,
  computeScaledSize,
  isImageFile,
} from '../../src/utils/image-compress'

describe('image-compress 常量', () => {
  it('默认长边上限为 1024', () => {
    expect(DEFAULT_IMAGE_MAX_SIDE).toBe(1024)
  })

  it('默认 JPEG 质量为 0.85', () => {
    expect(DEFAULT_IMAGE_JPEG_QUALITY).toBe(0.85)
  })

  it('JPEG data URL 前缀为 data:image/jpeg;base64,', () => {
    expect(JPEG_DATA_URL_PREFIX).toBe('data:image/jpeg;base64,')
  })
})

describe('computeScaledSize 长边缩放计算', () => {
  it('横图按长边等比缩小：2000×1000 → 1024×512，scale 0.512', () => {
    expect(computeScaledSize(2000, 1000, 1024)).toEqual({
      width: 1024,
      height: 512,
      scale: 0.512,
    })
  })

  it('竖图按长边等比缩小：1000×2000 → 512×1024，scale 0.512', () => {
    expect(computeScaledSize(1000, 2000, 1024)).toEqual({
      width: 512,
      height: 1024,
      scale: 0.512,
    })
  })

  it('小图（长短边均不超限）不放大：800×600 原尺寸返回，scale 1', () => {
    expect(computeScaledSize(800, 600, 1024)).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    })
  })

  it('长边刚好两倍：2048×1024 → 1024×512，scale 0.5', () => {
    expect(computeScaledSize(2048, 1024, 1024)).toEqual({
      width: 1024,
      height: 512,
      scale: 0.5,
    })
  })

  it('非整数尺寸四舍五入：1025×1000 → 宽 1024、高 999，scale 接近 1024/1025', () => {
    const result = computeScaledSize(1025, 1000, 1024)
    expect(result.width).toBe(1024)
    expect(result.height).toBe(999)
    expect(result.scale).toBeCloseTo(1024 / 1025, 12)
  })

  it('宽度为 0 时抛出 Error', () => {
    expect(() => computeScaledSize(0, 100, 1024)).toThrow(Error)
  })

  it('maxSide 为负数时抛出 Error', () => {
    expect(() => computeScaledSize(2000, 1000, -5)).toThrow(Error)
  })

  it('宽度为 NaN 时抛出 Error', () => {
    expect(() => computeScaledSize(Number.NaN, 100, 1024)).toThrow(Error)
  })

  it('高度为 Infinity 时抛出 Error', () => {
    expect(() =>
      computeScaledSize(2000, Number.POSITIVE_INFINITY, 1024),
    ).toThrow(Error)
  })
})

describe('clampImageQuality JPEG 质量归一', () => {
  it('合法质量 0.85 原样返回', () => {
    expect(clampImageQuality(0.85)).toBe(0.85)
  })

  it('undefined 回退默认 0.85', () => {
    expect(clampImageQuality(undefined)).toBe(0.85)
  })

  it('超过 1 的质量归一为 1', () => {
    expect(clampImageQuality(1.7)).toBe(1)
  })

  it('0 回退默认 0.85', () => {
    expect(clampImageQuality(0)).toBe(0.85)
  })

  it('NaN 回退默认 0.85', () => {
    expect(clampImageQuality(Number.NaN)).toBe(0.85)
  })

  it('Infinity 回退默认 0.85', () => {
    expect(clampImageQuality(Number.POSITIVE_INFINITY)).toBe(0.85)
  })

  it('提供 fallback 时合法质量 0.6 原样返回', () => {
    expect(clampImageQuality(0.6, 0.9)).toBe(0.6)
  })

  it('提供 fallback 时非法值 -1 回退 fallback 0.9', () => {
    expect(clampImageQuality(-1, 0.9)).toBe(0.9)
  })

  it('提供 fallback 时 undefined 回退 fallback 0.9', () => {
    expect(clampImageQuality(undefined, 0.9)).toBe(0.9)
  })
})

describe('buildJpegDataUrl data URL 拼装', () => {
  it('base64 前拼接 JPEG 前缀', () => {
    expect(buildJpegDataUrl('/9j/4AAQSkZJRgABAQ==')).toBe(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
    )
  })
})

describe('isImageFile 文件类型判断', () => {
  it('image/* 类型返回 true', () => {
    expect(isImageFile({ type: 'image/png' })).toBe(true)
  })

  it('非图片 MIME 类型返回 false', () => {
    expect(isImageFile({ type: 'application/pdf' })).toBe(false)
  })

  it('空字符串类型返回 false', () => {
    expect(isImageFile({ type: '' })).toBe(false)
  })
})
