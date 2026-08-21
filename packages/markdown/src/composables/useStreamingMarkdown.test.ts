import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useStreamingMarkdown } from './useStreamingMarkdown'

describe('useStreamingMarkdown', () => {
  let rafCbs: FrameRequestCallback[]
  let rafId: number
  beforeEach(() => {
    rafCbs = []
    rafId = 1
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCbs.push(cb)
      return rafId++
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => vi.unstubAllGlobals())
  const flushRaf = async () => {
    const cbs = [...rafCbs]
    rafCbs = []
    cbs.forEach((cb) => cb(0))
    await nextTick()
  }

  it('渲染 markdown 标题', async () => {
    const { html, setContent } = useStreamingMarkdown()
    setContent('# 你好')
    await flushRaf()
    expect(html.value).toContain('<h1>你好</h1>')
  })
  it('消毒 script 标签', async () => {
    const { html, setContent } = useStreamingMarkdown()
    setContent('<script>alert(1)</script>')
    await flushRaf()
    expect(html.value).not.toContain('<script>')
  })
  it('节流：多次 setContent 只在 rAF 后渲染一次', async () => {
    const { html, setContent } = useStreamingMarkdown()
    setContent('# A')
    setContent('# B')
    setContent('# C')
    expect(html.value).toBe('')
    await flushRaf()
    expect(html.value).toContain('<h1>C</h1>')
  })
  it('截断未闭合代码块', async () => {
    const { html, setContent } = useStreamingMarkdown()
    setContent('```js\n未闭合')
    await flushRaf()
    expect(html.value).not.toContain('<code')
  })
  it('卸载时取消待执行的 rAF 不抛错', async () => {
    const scope = effectScope()
    let api: ReturnType<typeof useStreamingMarkdown> | undefined
    scope.run(() => {
      api = useStreamingMarkdown()
    })
    api!.setContent('# 未渲染')
    // dispose while rAF is pending
    expect(() => scope.stop()).not.toThrow()
    // flushing remaining queued rAF callbacks after stop should not throw
    const cbs = [...rafCbs]
    rafCbs = []
    expect(() => cbs.forEach((cb) => cb(0))).not.toThrow()
  })

  it('flush 同步渲染：不等 rAF 直接产出 html', async () => {
    const { html, setContent, flush } = useStreamingMarkdown()
    setContent('# 立即')
    expect(html.value).toBe('') // rAF 尚未执行
    flush()
    expect(html.value).toContain('<h1>立即</h1>')
  })

  it('边界：SSR（无 window）时 setContent 不调度渲染', async () => {
    vi.stubGlobal('window', undefined)
    const { html, setContent } = useStreamingMarkdown()
    setContent('# 服务端')
    await flushRaf()
    expect(html.value).toBe('')
  })

  it('边界：SSR（无 window）时 flush 跳过渲染不抛错', () => {
    vi.stubGlobal('window', undefined)
    const { html, setContent, flush } = useStreamingMarkdown()
    setContent('# 服务端')
    expect(() => flush()).not.toThrow()
    expect(html.value).toBe('')
  })
})
