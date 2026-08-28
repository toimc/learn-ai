import { describe, it, expect } from 'vitest'
import { formatFileSize, formatDuration } from '../../src/utils/format'

describe('formatFileSize 文件大小格式化', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
    [1024 ** 3, '1.0 GB'],
  ] as const)('正常/边界：%d 字节 → %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })

  it('边界：B 级不保留小数，KB 及以上保留 1 位', () => {
    expect(formatFileSize(100)).toBe('100 B')
    expect(formatFileSize(1200)).toBe('1.2 KB')
  })
})

describe('formatDuration 耗时格式化', () => {
  it.each([
    [0, '0ms'],
    [500, '500ms'],
    [999, '999ms'],
    [1000, '1.0s'],
    [1500, '1.5s'],
    [10500, '10.5s'],
  ] as const)('正常/边界：%d ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})
