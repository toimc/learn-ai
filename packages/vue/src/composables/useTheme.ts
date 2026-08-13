import { ref, computed, watch, onMounted } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'ai-chat-theme'

// 模块级单例状态
const theme = ref<ThemeMode>('system')
const systemDark = ref(false)
let initialized = false
let mql: MediaQueryList | null = null

function resolve(t: ThemeMode): ResolvedTheme {
  return t === 'system' ? (systemDark.value ? 'dark' : 'light') : t
}

export const resolvedTheme = computed<ResolvedTheme>(() => resolve(theme.value))

function onSystemChange(e: MediaQueryListEvent) {
  systemDark.value = e.matches
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  // 读持久化
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
  if (saved) theme.value = saved
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mql.matches
  mql.addEventListener('change', onSystemChange)
}

// 应用 + 持久化（SSR 安全：仅在浏览器环境注册副作用）
if (typeof window !== 'undefined') {
  watch(
    resolvedTheme,
    (val) => {
      document.documentElement.setAttribute('data-theme', val)
    },
    { immediate: true },
  )
  watch(theme, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
  })
}

export function useTheme() {
  onMounted(init)
  const setTheme = (t: ThemeMode) => {
    theme.value = t
  }
  const toggleTheme = () => {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, resolvedTheme, setTheme, toggleTheme }
}
