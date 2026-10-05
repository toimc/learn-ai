/**
 * 端侧 embedding 管线（18-03）：Transformers.js v3 动态加载、进度、
 * 设备检测（WebGPU 优先 / WASM 回退）与 Cache Storage 探测。
 *
 * 所有外部能力（pipeline 加载器、WebGPU 检测、Cache Storage）皆可注入，
 * 测试注入 mock 即可，禁止真实下载模型。
 */
import { readonly, ref } from 'vue'
import { resolveBackend } from './pure'

export type EmbedDevice = 'webgpu' | 'wasm'
export type EmbedderStatus = 'idle' | 'loading' | 'ready' | 'error'

/** transformers.js progress_callback 事件（关注 status=progress 的百分比） */
export interface EmbedProgressInfo {
  status: string
  progress?: number
  file?: string
}

/** demo 侧最小管线接口：真实 FeatureExtractionPipeline 结构兼容，测试给 mock */
export interface EmbedFn {
  (
    text: string,
    options: { pooling: 'mean'; normalized: boolean },
  ): Promise<{
    data: Float32Array
  }>
}

export interface PipelineLoaderOptions {
  device: EmbedDevice
  onProgress: (info: EmbedProgressInfo) => void
}

export type PipelineLoader = (opts: PipelineLoaderOptions) => Promise<EmbedFn>

export const MODEL_ID = 'Xenova/bge-small-zh-v1.5'
export const MODEL_DTYPE = 'q8' as const
/** transformers.js 默认模型缓存所在的 Cache Storage 名 */
export const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

/**
 * 唯一的 transformers 引用点：动态 import，保证不进主 chunk。
 * q8 量化（体积约 fp32 的四分之一），device 由调用方按 navigator.gpu 决定。
 */
export const createTransformersLoader = (): PipelineLoader => {
  return async ({ device, onProgress }) => {
    const { pipeline } = await import('@huggingface/transformers')
    return pipeline('feature-extraction', MODEL_ID, {
      dtype: MODEL_DTYPE,
      device,
      progress_callback: onProgress,
    }) as unknown as EmbedFn
  }
}

export interface EdgeEmbedderOptions {
  /** 管线加载器（默认动态 import transformers.js） */
  loadPipeline?: PipelineLoader
  /** WebGPU 检测（默认 navigator.gpu 存在性） */
  detectWebGPU?: () => boolean
  /** WASM 可用性（浏览器 onnxruntime-web 附带 WASM 后端，默认可用） */
  supportsWasm?: () => boolean
  /** Cache Storage（jsdom 缺失时注入） */
  cacheStorage?: CacheStorage
}

export function createEdgeEmbedder(options: EdgeEmbedderOptions = {}) {
  const status = ref<EmbedderStatus>('idle')
  const progress = ref(0)
  const device = ref<EmbedDevice>('wasm')
  const cached = ref<boolean | null>(null)

  let embedFn: EmbedFn | null = null
  let loadPromise: Promise<EmbedFn | null> | null = null

  const hasWebGPU = () =>
    options.detectWebGPU
      ? options.detectWebGPU()
      : typeof navigator !== 'undefined' && 'gpu' in navigator

  const load = (): Promise<EmbedFn | null> => {
    if (embedFn) return Promise.resolve(embedFn)
    if (loadPromise) return loadPromise

    // 三级降级第一跳：连 WASM 都不可用时直接落关键字，不尝试加载
    const backend = resolveBackend(
      hasWebGPU(),
      options.supportsWasm?.() ?? true,
    )
    if (backend === 'keyword') {
      status.value = 'error'
      return Promise.resolve(null)
    }
    device.value = backend

    status.value = 'loading'
    progress.value = 0
    const loader = options.loadPipeline ?? createTransformersLoader()
    loadPromise = loader({
      device: device.value,
      onProgress: (info) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          progress.value = Math.round(info.progress)
        }
      },
    })
      .then((fn) => {
        embedFn = fn
        status.value = 'ready'
        progress.value = 100
        return fn
      })
      .catch(() => {
        // 加载失败 = 降级信号：返回 null，调用方回退关键字匹配；允许下次重试
        status.value = 'error'
        loadPromise = null
        return null
      })
    return loadPromise
  }

  const embed = async (text: string): Promise<Float32Array | null> => {
    const fn = embedFn ?? (await load())
    if (!fn) return null
    try {
      const output = await fn(text, { pooling: 'mean', normalized: true })
      return output.data
    } catch {
      return null
    }
  }

  /** 模型文件是否已进 Cache Storage（第二次访问秒级加载的依据） */
  const probeCache = async (): Promise<boolean> => {
    try {
      const storage =
        options.cacheStorage ??
        (typeof caches !== 'undefined' ? (caches as CacheStorage) : undefined)
      if (!storage) return false
      cached.value = await storage.has(TRANSFORMERS_CACHE_NAME)
      return cached.value
    } catch {
      return false
    }
  }

  return {
    status: readonly(status),
    progress: readonly(progress),
    device: readonly(device),
    cached: readonly(cached),
    load,
    embed,
    probeCache,
  }
}

export type EdgeEmbedder = ReturnType<typeof createEdgeEmbedder>
