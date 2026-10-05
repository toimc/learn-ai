import { describe, expect, it, vi } from 'vitest'
import {
  createEdgeEmbedder,
  createTransformersLoader,
  MODEL_ID,
  TRANSFORMERS_CACHE_NAME,
  type EmbedFn,
} from '../../src/semantic/edge-embedder'

/** 按文本查表返回固定向量的假管线（测试禁止真实下载模型） */
function fakeEmbedFn(
  table: Record<string, number[]>,
  fallback: number[] = [0, 0],
): EmbedFn {
  return async (text) => ({ data: Float32Array.from(table[text] ?? fallback) })
}

describe('createEdgeEmbedder', () => {
  it('加载中暴露进度（取整），非 progress 事件不清零；完成后 ready', async () => {
    let release!: (fn: EmbedFn) => void
    let emit!: (progress: number) => void
    const loader = vi.fn(
      (opts: {
        device: 'webgpu' | 'wasm'
        onProgress: (i: { status: string; progress?: number }) => void
      }) => {
        emit = (progress) => opts.onProgress({ status: 'progress', progress })
        emit(62.4)
        opts.onProgress({ status: 'done' })
        return new Promise<EmbedFn>((resolve) => {
          release = resolve
        })
      },
    )
    const embedder = createEdgeEmbedder({ loadPipeline: loader })
    const pending = embedder.load()
    expect(embedder.status.value).toBe('loading')
    // 手算：62.4 → 62；后续 88.6 → 89、7.2 → 7（证明是取整而非固定值）
    expect(embedder.progress.value).toBe(62)
    emit(88.6)
    expect(embedder.progress.value).toBe(89)
    emit(7.2)
    expect(embedder.progress.value).toBe(7)
    release(fakeEmbedFn({}))
    await pending
    expect(embedder.status.value).toBe('ready')
    expect(embedder.progress.value).toBe(100)
  })

  it('jsdom 无 navigator.gpu，默认设备为 wasm；检测到 WebGPU 时传 webgpu', async () => {
    const loaderWasm = vi.fn(async () => fakeEmbedFn({}))
    await createEdgeEmbedder({ loadPipeline: loaderWasm }).load()
    expect(loaderWasm.mock.calls[0][0].device).toBe('wasm')

    const loaderGpu = vi.fn(async () => fakeEmbedFn({}))
    await createEdgeEmbedder({
      loadPipeline: loaderGpu,
      detectWebGPU: () => true,
    }).load()
    expect(loaderGpu.mock.calls[0][0].device).toBe('webgpu')
  })

  it('supportsWasm 为假时三级决策直接落关键字（不调用管线）', async () => {
    const loader = vi.fn(async () => fakeEmbedFn({}))
    const embedder = createEdgeEmbedder({
      loadPipeline: loader,
      detectWebGPU: () => false,
      supportsWasm: () => false,
    })
    await expect(embedder.load()).resolves.toBeNull()
    expect(embedder.status.value).toBe('error')
    expect(loader).not.toHaveBeenCalled()
  })

  it('加载失败返回 null 进入 error，再次 load 可重试', async () => {
    let fail = true
    const loader = vi.fn(async () => {
      if (fail) throw new Error('network down')
      return fakeEmbedFn({})
    })
    const embedder = createEdgeEmbedder({ loadPipeline: loader })
    await expect(embedder.load()).resolves.toBeNull()
    expect(embedder.status.value).toBe('error')

    fail = false
    await expect(embedder.load()).resolves.toBeTypeOf('function')
    expect(embedder.status.value).toBe('ready')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('并发 load 复用同一次加载（管线单例）', async () => {
    const loader = vi.fn(async () => fakeEmbedFn({}))
    const embedder = createEdgeEmbedder({ loadPipeline: loader })
    const [a, b] = await Promise.all([embedder.load(), embedder.load()])
    expect(a).toBe(b)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('embed 以 mean 池化 + 归一化调用管线并返回向量', async () => {
    const fn = vi.fn(fakeEmbedFn({ 任意: [0.5, 0.5] }))
    const embedder = createEdgeEmbedder({ loadPipeline: async () => fn })
    const vec = await embedder.embed('任意')
    expect(fn).toHaveBeenCalledWith('任意', {
      pooling: 'mean',
      normalized: true,
    })
    expect(vec).toEqual(Float32Array.from([0.5, 0.5]))
  })

  it('embed 前自动触发加载（无需手动 load）', async () => {
    const loader = vi.fn(async () => fakeEmbedFn({ q: [1, 0] }))
    const embedder = createEdgeEmbedder({ loadPipeline: loader })
    const vec = await embedder.embed('q')
    expect(loader).toHaveBeenCalledTimes(1)
    expect(vec).toEqual(Float32Array.from([1, 0]))
  })

  it('管线执行抛错时 embed 返回 null（降级信号，不向上抛）', async () => {
    const bad: EmbedFn = async () => {
      throw new Error('wasm oom')
    }
    const embedder = createEdgeEmbedder({ loadPipeline: async () => bad })
    await expect(embedder.embed('x')).resolves.toBeNull()
  })
})

describe('probeCache（Cache Storage 探测）', () => {
  it('模型缓存已存在时 cached 为 true', async () => {
    const caches = {
      has: async (name: string) => name === TRANSFORMERS_CACHE_NAME,
    }
    const embedder = createEdgeEmbedder({
      cacheStorage: caches as unknown as CacheStorage,
    })
    await expect(embedder.probeCache()).resolves.toBe(true)
    expect(embedder.cached.value).toBe(true)
  })

  it('Cache Storage 抛错或缺失时安全返回 false', async () => {
    const broken = {
      has: async () => {
        throw new Error('quota')
      },
    }
    const embedder = createEdgeEmbedder({
      cacheStorage: broken as unknown as CacheStorage,
    })
    await expect(embedder.probeCache()).resolves.toBe(false)

    // 未注入且全局无 caches（jsdom 即如此）→ false
    const bare = createEdgeEmbedder({})
    await expect(bare.probeCache()).resolves.toBe(false)
  })
})

describe('常量', () => {
  it('模型与缓存名与 18-03 规格一致', () => {
    expect(MODEL_ID).toBe('Xenova/bge-small-zh-v1.5')
    expect(TRANSFORMERS_CACHE_NAME).toBe('transformers-cache')
    expect(typeof createTransformersLoader).toBe('function')
  })
})
