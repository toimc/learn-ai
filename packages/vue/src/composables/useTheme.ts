import { ref, reactive, computed, watch, onMounted } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type ThemeTarget = 'html' | 'component'

export interface UseThemeOptions {
  /** data-theme 写入位置：html（宿主根）或 component（组件根元素），默认 'html' */
  target?: ThemeTarget
  /** 是否读写 localStorage，默认 true */
  persist?: boolean
}

const STORAGE_KEY = 'ai-chat-theme'

// 模块级单例状态
const theme = ref<ThemeMode>('system')
const systemDark = ref(false)
// 挂载目标与持久化选项：首次传入 options 的 useTheme 调用生效，后续调用忽略
const options = reactive<{ target: ThemeTarget; persist: boolean }>({
  target: 'html',
  persist: true,
})
let optionsApplied = false
let initialized = false
let mql: MediaQueryList | null = null

function resolve(t: ThemeMode): ResolvedTheme {
  return t === 'system' ? (systemDark.value ? 'dark' : 'light') : t
}

export const resolvedTheme = computed<ResolvedTheme>(() => resolve(theme.value))

// 组件根绑定的主题值：仅 target='component' 时有值（undefined 时 Vue 移除该属性）
export const componentTheme = computed<ResolvedTheme | undefined>(() =>
  options.target === 'component' ? resolvedTheme.value : undefined,
)

function onSystemChange(e: MediaQueryListEvent) {
  systemDark.value = e.matches
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  // 读持久化
  if (options.persist) {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (saved) theme.value = saved
  }
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mql.matches
  mql.addEventListener('change', onSystemChange)
}

// 应用 + 持久化（SSR 安全：仅在浏览器环境注册副作用）
if (typeof window !== 'undefined') {
  watch(
    [resolvedTheme, () => options.target],
    ([val]) => {
      if (options.target === 'html') {
        document.documentElement.setAttribute('data-theme', val)
      } else {
        // 组件模式不碰宿主 <html>，清理此前 html 模式可能遗留的属性
        document.documentElement.removeAttribute('data-theme')
      }
    },
    { immediate: true },
  )
  watch(theme, (val) => {
    if (options.persist) localStorage.setItem(STORAGE_KEY, val)
  })
}

export function useTheme(opts?: UseThemeOptions) {
  if (opts && !optionsApplied) {
    optionsApplied = true
    if (opts.target) options.target = opts.target
    if (opts.persist !== undefined) options.persist = opts.persist
  }
  onMounted(init)
  const setTheme = (t: ThemeMode) => {
    theme.value = t
  }
  const toggleTheme = () => {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, resolvedTheme, setTheme, toggleTheme }
}
