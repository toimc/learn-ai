import {
  clampImageQuality,
  computeScaledSize,
  DEFAULT_IMAGE_MAX_SIDE,
} from '@toimc/core'

/** 压缩流程可绘制图片源（ImageBitmap / HTMLImageElement 共同消费形状） */
export interface DrawableImageSource {
  width: number
  height: number
}

/** 依赖注入点：解码与画布均可替换，供 jsdom 等无 canvas 环境测试 */
export interface CompressImageDeps {
  decodeImage?: (file: File) => Promise<DrawableImageSource & CanvasImageSource>
  createCanvas?: () => HTMLCanvasElement
}

export interface CompressImageOptions {
  /** 长边像素上限，默认 1024；非正数或非有限值回退默认 */
  maxSide?: number
  /** JPEG 质量 0-1，默认 0.85；非法值回退默认，大于 1 收敛到 1 */
  quality?: number
  signal?: AbortSignal
  deps?: CompressImageDeps
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('图片压缩已取消', 'AbortError')
  }
}

function resolveMaxSide(maxSide: number | undefined): number {
  if (maxSide !== undefined && Number.isFinite(maxSide) && maxSide > 0) {
    return maxSide
  }
  return DEFAULT_IMAGE_MAX_SIDE
}

/** File → canvas 等比压缩（长边上限内不放大）→ JPEG data URL，产物通常 100-300KB */
export async function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions = {},
): Promise<string> {
  throwIfAborted(options.signal)

  if (!file.type.startsWith('image/')) {
    throw new Error(
      `仅支持图片文件，已忽略：${file.name || file.type || '未知文件'}`,
    )
  }

  const decodeImage =
    options.deps?.decodeImage ?? ((f: File) => createImageBitmap(f))

  let source: DrawableImageSource & CanvasImageSource
  try {
    source = await decodeImage(file)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    const reason = error instanceof Error ? error.message : String(error)
    // base tsconfig target 为 ES2020，Error(msg, { cause }) 构造重载（ES2022）过不了
    // vue-tsc；属性赋值保留 cause 且类型兼容
    const wrapped = new Error(`图片解码失败，请确认文件完整（${reason}）`)
    ;(wrapped as Error & { cause?: unknown }).cause = error
    throw wrapped
  }

  try {
    throwIfAborted(options.signal)

    if (
      !Number.isFinite(source.width) ||
      !Number.isFinite(source.height) ||
      source.width <= 0 ||
      source.height <= 0
    ) {
      throw new Error('无法读取图片尺寸，文件可能已损坏')
    }

    const size = computeScaledSize(
      source.width,
      source.height,
      resolveMaxSide(options.maxSide),
    )

    const createCanvas =
      options.deps?.createCanvas ?? (() => document.createElement('canvas'))
    const canvas = createCanvas()
    canvas.width = size.width
    canvas.height = size.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('当前环境不支持 canvas 2d 绘制')
    }

    // JPEG 无透明通道：先铺白底，避免透明区域导出为黑底
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.drawImage(source, 0, 0, size.width, size.height)

    return canvas.toDataURL('image/jpeg', clampImageQuality(options.quality))
  } finally {
    // ImageBitmap 用完即释放；注入源可能无 close，安全跳过
    const maybeClose = source as { close?: unknown }
    if (typeof maybeClose.close === 'function') {
      maybeClose.close()
    }
  }
}
