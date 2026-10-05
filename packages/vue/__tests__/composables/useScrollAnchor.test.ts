import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useScrollAnchor } from '../../src/composables/useScrollAnchor'

/** jsdom 无布局引擎：用 defineProperty 直接控 scrollTop/scrollHeight/clientHeight */
function makeScrollEl(metrics: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}) {
  const el = document.createElement('div')
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, {
      value,
      writable: true,
      configurable: true,
    })
  }
  document.body.appendChild(el)
  return el
}

/** 可手动触发回调、可断言 disconnect 的 ResizeObserver mock */
class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  disconnected = false
  constructor(
    private readonly cb: () => void,
    public readonly observed: Element[] = [],
  ) {
    MockResizeObserver.instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  disconnect() {
    this.disconnected = true
  }
  trigger() {
    this.cb()
  }
}

const OriginalRO = window.ResizeObserver

beforeEach(() => {
  MockResizeObserver.instances = []
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

afterEach(() => {
  window.ResizeObserver = OriginalRO
  document.body.innerHTML = ''
})

/** 等待 requestAnimationFrame 回调执行完毕 */
function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

describe('useScrollAnchor isAtBottom 判定', () => {
  it('初始值为 true（未见滚动位置前乐观跟随）', () => {
    const anchor = useScrollAnchor()
    expect(anchor.isAtBottom.value).toBe(true)
  })

  it('正常：滚动后距底小于阈值判定为在底部', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 560,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    // 1000 - 560 - 400 = 40 < 50
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(true)
  })

  it('边界：距底恰好等于阈值 50 判定为在底部（< 而非 <=）', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 550,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    // 1000 - 550 - 400 = 50，不小于 50 → 不在底部
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(false)
  })

  it('正常：滚离底部后判定为 false', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 300,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(false)
  })

  it('边界：自定义阈值生效', () => {
    const anchor = useScrollAnchor(10)
    const el = makeScrollEl({
      scrollTop: 580,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    // 距底 20，阈值 10 → 不在底部
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(false)
  })
})

describe('useScrollAnchor scrollToBottom', () => {
  it('正常：下一帧将容器滚到底部', async () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 0,
      scrollHeight: 800,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    anchor.scrollToBottom()
    await nextFrame()
    expect(el.scrollTop).toBe(800)
  })

  it('异常：未绑定容器时调用不抛错', () => {
    const anchor = useScrollAnchor()
    expect(() => anchor.scrollToBottom()).not.toThrow()
  })
})

describe('useScrollAnchor bindContainer 生命周期', () => {
  it('正常：绑定容器创建 observer 并 observe 该容器', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 50,
    })
    anchor.bindContainer(el)

    expect(MockResizeObserver.instances).toHaveLength(1)
    expect(MockResizeObserver.instances[0].observed).toEqual([el])
  })

  it('边界：绑定 null 时不创建 observer', () => {
    const anchor = useScrollAnchor()
    anchor.bindContainer(null)
    expect(MockResizeObserver.instances).toHaveLength(0)
  })

  it('正常：重复绑定时断开旧 observer，只保留新的', () => {
    const anchor = useScrollAnchor()
    const first = makeScrollEl({
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 50,
    })
    const second = makeScrollEl({
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 50,
    })
    anchor.bindContainer(first)
    anchor.bindContainer(second)

    expect(MockResizeObserver.instances).toHaveLength(2)
    expect(MockResizeObserver.instances[0].disconnected).toBe(true)
    expect(MockResizeObserver.instances[1].disconnected).toBe(false)
    expect(MockResizeObserver.instances[1].observed).toEqual([second])
  })

  it('正常：绑 null 解绑时断开 observer，scroll 判定不再生效', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    anchor.bindContainer(null)

    expect(MockResizeObserver.instances[0].disconnected).toBe(true)
    // 解绑后 dispatch scroll 不应改动 isAtBottom
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(true)
  })
})

describe('useScrollAnchor ResizeObserver 自动跟随', () => {
  it('正常：在底部时容器尺寸变化自动滚到底', async () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 600,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    // 内容增高
    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    await nextFrame()
    expect(el.scrollTop).toBe(1400)
  })

  it('正常：用户上滑离开底部后，尺寸变化不再强制跟随', async () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)

    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(false)

    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    await nextFrame()
    expect(el.scrollTop).toBe(100)
  })
})

describe('useScrollAnchor unreadCount 未读计数', () => {
  it('初始值为 0（未见内容变化前不计未读）', () => {
    const anchor = useScrollAnchor()
    expect(anchor.unreadCount.value).toBe(0)
  })

  it('正常：离底时内容高度增加，逐次递增计数', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(false)

    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(1)

    Object.defineProperty(el, 'scrollHeight', {
      value: 1800,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(2)
  })

  it('正常：贴底时内容高度增加不计数且保持跟随', async () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 600,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(true)

    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    await nextFrame()

    expect(anchor.unreadCount.value).toBe(0)
    expect(el.scrollTop).toBe(1400)
  })

  it('正常：scrollToBottom 调用后计数立即清零', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(1)

    anchor.scrollToBottom()
    expect(anchor.unreadCount.value).toBe(0)
  })

  it('正常：手动滚回贴底（scroll 事件判定贴底）计数清零', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(1)

    // 手动滚到距底 10px（< 阈值 50）→ 判定贴底并清零
    Object.defineProperty(el, 'scrollTop', {
      value: 990,
      writable: true,
      configurable: true,
    })
    el.dispatchEvent(new Event('scroll'))
    expect(anchor.isAtBottom.value).toBe(true)
    expect(anchor.unreadCount.value).toBe(0)
  })

  it('边界：内容高度不变时触发 ResizeObserver 不计数', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))

    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(0)
  })

  it('边界：内容高度收缩时离底不计数', () => {
    const anchor = useScrollAnchor()
    const el = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(el)
    el.dispatchEvent(new Event('scroll'))

    Object.defineProperty(el, 'scrollHeight', {
      value: 800,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(0)
  })

  it('正常：重新绑定容器时计数清零且以新容器当前高度为基线', () => {
    const anchor = useScrollAnchor()
    const first = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(first)
    first.dispatchEvent(new Event('scroll'))
    Object.defineProperty(first, 'scrollHeight', {
      value: 1400,
      writable: true,
      configurable: true,
    })
    MockResizeObserver.instances[0].trigger()
    expect(anchor.unreadCount.value).toBe(1)

    const second = makeScrollEl({
      scrollTop: 100,
      scrollHeight: 1000,
      clientHeight: 400,
    })
    anchor.bindContainer(second)
    expect(anchor.unreadCount.value).toBe(0)

    // 新容器高度未变时触发回调，不应把绑定时高度误判为新增
    second.dispatchEvent(new Event('scroll'))
    MockResizeObserver.instances[1].trigger()
    expect(anchor.unreadCount.value).toBe(0)
  })
})
