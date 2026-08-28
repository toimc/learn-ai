import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Ref } from 'vue'

// ---- jsdom 环境 mock ----
// useTheme 模块加载时立即注册 watch 副作用（写 documentElement data-theme、localStorage），
// 必须在 import 前把 window 守卫依赖的 API mock 掉。
const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => void storage.set(k, v)),
  removeItem: vi.fn((k: string) => void storage.delete(k)),
  clear: vi.fn(() => storage.clear()),
  key: vi.fn(() => null),
  length: 0,
})

const matchMediaListeners: ((e: { matches: boolean }) => void)[] = []
let matchMediaValue = false
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: matchMediaValue,
  media: query,
  addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => {
    matchMediaListeners.push(cb)
  },
  removeEventListener: (
    _type: string,
    cb: (e: { matches: boolean }) => void,
  ) => {
    const i = matchMediaListeners.indexOf(cb)
    if (i >= 0) matchMediaListeners.splice(i, 1)
  },
}))

// ---- 动态导入被测模块（每用例重置模块级单例）----
// 通过 vi.resetModules + dynamic import 拿到全新模块实例，
// 让 init()/initialized、模块级 watch 在每个用例独立。
async function importFresh() {
  vi.resetModules()
  return (await import('../../src/composables/useTheme')) as typeof import('../../src/composables/useTheme')
}

const tick = () => new Promise((r) => setTimeout(r, 0))

// 在 setup() 内调用 useTheme，避免 onMounted 注册告警
function mountWithTheme<T>(
  mod: typeof import('../../src/composables/useTheme'),
  setupExtra?: (ctx: {
    theme: Ref<import('../../src/composables/useTheme').ThemeMode>
    resolvedTheme: Ref<import('../../src/composables/useTheme').ResolvedTheme>
    setTheme: (t: import('../../src/composables/useTheme').ThemeMode) => void
    toggleTheme: () => void
  }) => T,
) {
  let ctx: Parameters<NonNullable<typeof setupExtra>>[0] | undefined
  const wrapper = mount(
    defineComponent({
      setup() {
        ctx = mod.useTheme()
        const extra = setupExtra?.(ctx!)
        return () => h('div', extra === undefined ? '' : String(extra))
      },
    }),
  )
  return { wrapper, getCtx: () => ctx! }
}

describe('useTheme', () => {
  beforeEach(() => {
    storage.clear()
    matchMediaValue = false
    matchMediaListeners.length = 0
    document.documentElement.removeAttribute('data-theme')
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('默认 system + 系统亮色 → resolvedTheme=light，写 data-theme 到 documentElement', async () => {
    const mod = await importFresh()
    const { wrapper } = mountWithTheme(mod)
    await tick()
    expect(mod.resolvedTheme.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    wrapper.unmount()
  })

  it('system + 系统暗色 → resolvedTheme=dark', async () => {
    const mod = await importFresh()
    matchMediaValue = true // init() 在 onMounted 读 mql.matches 时拿到 true
    const { wrapper } = mountWithTheme(mod)
    await tick()
    expect(mod.resolvedTheme.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    wrapper.unmount()
  })

  it('setTheme 持久化到 localStorage', async () => {
    const mod = await importFresh()
    const { wrapper, getCtx } = mountWithTheme(mod)
    await tick()
    getCtx().setTheme('dark')
    await tick()
    expect(getCtx().theme.value).toBe('dark')
    expect(storage.get('ai-chat-theme')).toBe('dark')
    wrapper.unmount()
  })

  it('从 localStorage 读回偏好', async () => {
    storage.set('ai-chat-theme', 'dark')
    const mod = await importFresh()
    const { wrapper, getCtx } = mountWithTheme(mod)
    await tick()
    expect(getCtx().theme.value).toBe('dark')
    wrapper.unmount()
  })

  it('toggleTheme 在 light 与 dark 间切换', async () => {
    const mod = await importFresh()
    const { wrapper, getCtx } = mountWithTheme(mod)
    await tick()
    expect(mod.resolvedTheme.value).toBe('light')
    getCtx().toggleTheme()
    await tick()
    expect(mod.resolvedTheme.value).toBe('dark')
    getCtx().toggleTheme()
    await tick()
    expect(mod.resolvedTheme.value).toBe('light')
    wrapper.unmount()
  })

  it('系统偏好变化时 system 模式同步切换', async () => {
    const mod = await importFresh()
    const { wrapper } = mountWithTheme(mod)
    await tick()
    expect(mod.resolvedTheme.value).toBe('light')
    // 触发 matchMedia change 事件
    for (const cb of [...matchMediaListeners]) cb({ matches: true })
    await tick()
    expect(mod.resolvedTheme.value).toBe('dark')
    wrapper.unmount()
  })

  it('单例：多次 useTheme 共享同一 theme ref', async () => {
    const mod = await importFresh()
    let a: ReturnType<typeof mod.useTheme> | undefined
    let b: ReturnType<typeof mod.useTheme> | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          a = mod.useTheme()
          b = mod.useTheme()
          // 同一模块实例下的 theme ref 必须共享
          a.setTheme('dark')
          return () => h('div')
        },
      }),
    )
    await tick()
    expect(a!.theme).toBe(b!.theme)
    expect(b!.theme.value).toBe('dark')
    wrapper.unmount()
  })

  // ---- target / persist 选项 ----

  it("target='component'：documentElement 不写 data-theme，componentTheme 跟随切换", async () => {
    const mod = await importFresh()
    let ctx: ReturnType<typeof mod.useTheme> | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          ctx = mod.useTheme({ target: 'component' })
          return () => h('div')
        },
      }),
    )
    await tick()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(mod.componentTheme?.value).toBe('light')
    ctx!.setTheme('dark')
    await tick()
    // 切主题后 html 仍保持干净，主题值只暴露给组件根绑定
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(mod.componentTheme?.value).toBe('dark')
    wrapper.unmount()
  })

  it("target='html'（默认）：componentTheme 为 undefined，不产生组件级属性", async () => {
    const mod = await importFresh()
    const { wrapper } = mountWithTheme(mod)
    await tick()
    expect(mod.componentTheme?.value).toBeUndefined()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    wrapper.unmount()
  })

  it('persist=false：不写也不读 localStorage', async () => {
    storage.set('ai-chat-theme', 'dark')
    const mod = await importFresh()
    let ctx: ReturnType<typeof mod.useTheme> | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          ctx = mod.useTheme({ persist: false })
          return () => h('div')
        },
      }),
    )
    await tick()
    // 未读回旧值、未写入新值（预置旧值原样留在 storage）
    expect(ctx!.theme.value).toBe('system')
    expect(localStorage.getItem).not.toHaveBeenCalled()
    ctx!.setTheme('dark')
    await tick()
    expect(ctx!.theme.value).toBe('dark')
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(storage.get('ai-chat-theme')).toBe('dark')
    wrapper.unmount()
  })

  it('options 首次传入生效，后续调用忽略', async () => {
    const mod = await importFresh()
    let a: ReturnType<typeof mod.useTheme> | undefined
    const wrapper = mount(
      defineComponent({
        setup() {
          a = mod.useTheme({ target: 'component', persist: false })
          mod.useTheme({ target: 'html', persist: true })
          return () => h('div')
        },
      }),
    )
    await tick()
    await tick()
    // 首次 options 生效：html 干净、无持久化
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    a!.setTheme('dark')
    await tick()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(storage.has('ai-chat-theme')).toBe(false)
    wrapper.unmount()
  })
})
