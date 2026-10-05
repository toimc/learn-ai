import { describe, it, expect, vi } from 'vitest'
import { compressImageToDataUrl } from '../../src/utils/compress-image'
import type {
  CompressImageDeps,
  CompressImageOptions,
  DrawableImageSource,
} from '../../src/utils/compress-image'

const FAKE_DATA_URL = 'data:image/jpeg;base64,ZmFrZQ=='

function makeImageFile(type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3])], 'photo.png', { type })
}

interface FakeSetupOptions {
  sourceWidth?: number
  sourceHeight?: number
  getContext?: () => CanvasRenderingContext2D | null
  decode?: (file: File) => Promise<DrawableImageSource & CanvasImageSource>
}

/** jsdom 无 createImageBitmap 且 canvas.getContext 返回 null，全部能力经 deps 注入 fake */
function setupFake(options: FakeSetupOptions = {}) {
  const { sourceWidth = 2000, sourceHeight = 1000 } = options

  const close = vi.fn()
  const source = {
    width: sourceWidth,
    height: sourceHeight,
    close,
  } as unknown as DrawableImageSource & CanvasImageSource

  const drawImage = vi.fn()
  const fillRect = vi.fn()
  const ctx = { drawImage, fillRect } as unknown as CanvasRenderingContext2D

  const toDataURL = vi.fn((): string => FAKE_DATA_URL)
  const getContext = options.getContext
    ? vi.fn(options.getContext)
    : vi.fn(() => ctx)
  const canvas = {
    width: 0,
    height: 0,
    getContext,
    toDataURL,
  } as unknown as HTMLCanvasElement

  const decodeImage = options.decode
    ? vi.fn(options.decode)
    : vi.fn(async () => source)
  const createCanvas = vi.fn(() => canvas)

  const deps: CompressImageDeps = { decodeImage, createCanvas }
  return {
    source,
    close,
    drawImage,
    fillRect,
    ctx,
    toDataURL,
    getContext,
    canvas,
    decodeImage,
    createCanvas,
    deps,
  }
}

describe('compressImageToDataUrl 编排', () => {
  it('正常链路：按默认长边 1024 等比压缩，以 0.85 质量导出 data URL', async () => {
    const file = makeImageFile()
    const fake = setupFake()

    const result = await compressImageToDataUrl(file, { deps: fake.deps })

    expect(result).toBe(FAKE_DATA_URL)
    expect(fake.decodeImage).toHaveBeenCalledTimes(1)
    expect(fake.decodeImage).toHaveBeenCalledWith(file)
    expect(fake.canvas.width).toBe(1024)
    expect(fake.canvas.height).toBe(512)
    expect(fake.fillRect).toHaveBeenCalledWith(0, 0, 1024, 512)
    expect(fake.drawImage).toHaveBeenCalledTimes(1)
    expect(fake.drawImage).toHaveBeenCalledWith(fake.source, 0, 0, 1024, 512)
    expect(fake.toDataURL).toHaveBeenCalledTimes(1)
    expect(fake.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85)
  })

  it('quality 超过 1 时归一为 1 传给 toDataURL', async () => {
    const fake = setupFake()

    await compressImageToDataUrl(makeImageFile(), {
      quality: 2,
      deps: fake.deps,
    })

    expect(fake.toDataURL).toHaveBeenCalledWith('image/jpeg', 1)
  })

  it('maxSide 非法（0）时回退默认 1024', async () => {
    const fake = setupFake()

    await compressImageToDataUrl(makeImageFile(), {
      maxSide: 0,
      deps: fake.deps,
    })

    expect(fake.canvas.width).toBe(1024)
  })

  it('maxSide 512 时画布缩到 512×256', async () => {
    const fake = setupFake()

    await compressImageToDataUrl(makeImageFile(), {
      maxSide: 512,
      deps: fake.deps,
    })

    expect(fake.canvas.width).toBe(512)
    expect(fake.canvas.height).toBe(256)
  })

  it('非图片文件被拒绝并给出可读错误', async () => {
    const fake = setupFake()
    const file = makeImageFile('text/plain')

    await expect(
      compressImageToDataUrl(file, { deps: fake.deps }),
    ).rejects.toThrow('仅支持图片文件')
  })

  it('解码失败时 reject 且错误信息包含原始原因', async () => {
    const fake = setupFake()
    const deps: CompressImageDeps = {
      ...fake.deps,
      decodeImage: vi.fn(async () => {
        throw new Error('bad frame')
      }),
    }

    let caught: unknown
    try {
      await compressImageToDataUrl(makeImageFile(), { deps })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('图片解码失败')
    expect((caught as Error).message).toContain('bad frame')
  })

  it('解码结果宽度为 0 时 reject 并提示无法读取图片尺寸', async () => {
    const fake = setupFake({ sourceWidth: 0, sourceHeight: 100 })

    await expect(
      compressImageToDataUrl(makeImageFile(), { deps: fake.deps }),
    ).rejects.toThrow('无法读取图片尺寸')
  })

  it('调用前 signal 已 aborted 时以 AbortError 拒绝', async () => {
    const fake = setupFake()
    const controller = new AbortController()
    controller.abort()
    const options: CompressImageOptions = {
      signal: controller.signal,
      deps: fake.deps,
    }

    await expect(
      compressImageToDataUrl(makeImageFile(), options),
    ).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('解码过程中被 abort 时以 AbortError 拒绝', async () => {
    const controller = new AbortController()
    const fake = setupFake({
      decode: async () => {
        controller.abort()
        return setupFake().source
      },
    })
    const options: CompressImageOptions = {
      signal: controller.signal,
      deps: fake.deps,
    }

    await expect(
      compressImageToDataUrl(makeImageFile(), options),
    ).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('canvas 2d 上下文不可用时 reject 且错误信息提到 canvas', async () => {
    const fake = setupFake({ getContext: () => null })

    await expect(
      compressImageToDataUrl(makeImageFile(), { deps: fake.deps }),
    ).rejects.toThrow('canvas')
  })

  it('成功路径释放图片源：close 被调用一次', async () => {
    const fake = setupFake()

    await compressImageToDataUrl(makeImageFile(), { deps: fake.deps })

    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it('getContext 返回 null 的失败路径也释放图片源', async () => {
    const fake = setupFake({ getContext: () => null })

    await expect(
      compressImageToDataUrl(makeImageFile(), { deps: fake.deps }),
    ).rejects.toThrow('canvas')
    expect(fake.close).toHaveBeenCalledTimes(1)
  })
})
