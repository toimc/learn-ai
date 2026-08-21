# useTheme

主题（明暗）运行时切换 composable。**模块级单例**——全应用共享同一份主题状态，自动持久化到 `localStorage` 并写入 `document.documentElement` 的 `data-theme`，驱动 `[data-theme='dark']` 令牌翻转。

## 函数签名

```typescript
function useTheme(options?: UseThemeOptions): {
  theme: Ref<ThemeMode>
  resolvedTheme: Readonly<Ref<ResolvedTheme>>
  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
}
```

模块同时导出单例计算属性 `resolvedTheme`，可在非组件场景直接读取当前生效明暗。

## 类型

```typescript
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface UseThemeOptions {
  /** data-theme 写入位置：'html'（宿主根，默认）或 'component'（组件根元素） */
  target?: 'html' | 'component'
  /** 是否读写 localStorage，默认 true */
  persist?: boolean
}
```

## 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `target` | `'html' \| 'component'` | `'html'` | `data-theme` 写入位置。`'html'` 写宿主 `<html>`，整页生效（默认，向后兼容）；`'component'` 只写组件根元素，暗色令牌仅作用于组件子树，不碰宿主主题系统 |
| `persist` | `boolean` | `true` | 是否把主题读写到 `localStorage['ai-chat-theme']`。`false` 关闭持久化，刷新后回到默认 |

> 选项由**首次带 options 的调用**生效（单例），后续调用忽略；不带 options 的调用保持默认行为。

## 返回值

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `theme` | `Ref<ThemeMode>` | 当前主题模式，`'system'` 表示跟随系统 |
| `resolvedTheme` | `Readonly<Ref<ResolvedTheme>>` | 实际生效的明暗（`system` 已解析为 `light` / `dark`） |
| `setTheme(t)` | `(t: ThemeMode) => void` | 设置主题并持久化 |
| `toggleTheme()` | `() => void` | 在 `light` / `dark` 之间切换 |

## 特性

- **模块级单例**：任意多个组件调用 `useTheme()` 共享同一份状态，切换一处全局生效。
- **持久化**：默认写入 `localStorage['ai-chat-theme']`，刷新后保留；`persist: false` 关闭。
- **跟随系统**：`theme = 'system'` 时监听 `prefers-color-scheme`，系统切换自动跟随。
- **自动应用**：把解析后的明暗写入 `data-theme` 属性，组件令牌自动翻转；写入位置由 `target` 选项决定（默认 `<html>`）。
- **SSR 安全**：所有 `window` / `localStorage` 访问都有 `typeof window` 守卫，可在 `<script setup>` 中直接调用。

## 示例

点击按钮在亮 / 暗之间切换（会切换整页主题）：

<script setup>
import { useTheme } from '@toimc/vue'
const { resolvedTheme, toggleTheme } = useTheme()
</script>

<Button type="primary" @click="toggleTheme">
  当前：{{ resolvedTheme === 'dark' ? '🌙 暗色（点击切亮）' : '☀ 亮色（点击切暗）' }}
</Button>

```vue
<script setup lang="ts">
import { useTheme } from '@toimc/vue'

const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

// 跟随系统
setTheme('system')
// 或强制亮 / 暗
setTheme('dark')
// 或一键切换
toggleTheme()
</script>

<template>
  <button @click="toggleTheme">
    {{ resolvedTheme === 'dark' ? '🌙' : '☀' }}
  </button>
</template>
```

## 组件内主题（不碰宿主）

宿主应用有自己的主题系统时，用 `target: 'component'` 把 `data-theme` 限定在组件子树，同时可用 `persist: false` 关闭 `localStorage` 写入：

```vue
<script setup lang="ts">
import { useTheme } from '@toimc/vue'

const { resolvedTheme, toggleTheme } = useTheme({ target: 'component', persist: false })
</script>

<template>
  <button @click="toggleTheme">
    {{ resolvedTheme === 'dark' ? '🌙' : '☀' }}
  </button>
</template>
```

此模式下宿主 `<html>` 不会被写入 `data-theme`，暗色令牌只在聊天组件子树内翻转。

## 相关

- [主题定制指南](/guide/theming)：三层令牌结构、Props 配置、CSS 变量覆盖。
- [主题配置器](/theme-builder)：可视化调整全部令牌并导出 CSS 覆盖文件。
- [useThemePreset](/composables/use-theme-preset)：把预设 / 自定义变量应用到指定容器。
