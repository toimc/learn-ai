/** 图片压缩默认参数（多模态发送链路约定：长边 1024 / JPEG 0.85，产物约 100-300KB） */
export const DEFAULT_IMAGE_MAX_SIDE = 1024
export const DEFAULT_IMAGE_JPEG_QUALITY = 0.85
export const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,'

export interface ScaledSize {
  width: number
  height: number
  /** 实际应用的比例；原图长边不超上限时不放大，恒为 1 */
  scale: number
}

/** 长边缩放计算：scale = min(1, maxSide / max(width, height))，宽高各 Math.round */
export function computeScaledSize(
  width: number,
  height: number,
  maxSide: number,
): ScaledSize {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxSide) ||
    width <= 0 ||
    height <= 0 ||
    maxSide <= 0
  ) {
    throw new Error('computeScaledSize 需要正的宽、高与长边上限')
  }
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  }
}

/** JPEG 质量归一：undefined/NaN/Infinity/<=0 回退 fallback（缺省 0.85），>1 收敛到 1 */
export function clampImageQuality(
  quality: number | undefined,
  fallback: number = DEFAULT_IMAGE_JPEG_QUALITY,
): number {
  if (quality === undefined || !Number.isFinite(quality) || quality <= 0) {
    return fallback
  }
  return Math.min(quality, 1)
}

/** 已持有裸 base64 时拼装完整 JPEG data URL */
export function buildJpegDataUrl(base64: string): string {
  return JPEG_DATA_URL_PREFIX + base64
}

/** mediaType 以 image/ 开头即图片 */
export function isImageFile(file: { type: string }): boolean {
  return file.type.startsWith('image/')
}
