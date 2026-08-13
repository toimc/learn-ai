# useTheme

主题（明暗）运行时切换 composable。**模块级单例**——全应用共享同一份主题状态，自动持久化到 `localStorage` 并写入 `document.documentElement` 的 `data-theme`，驱动 `[data-theme='dark']` 令牌翻转。

## 函数签名

```typescript
function useTheme(): {
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
```

## 返回值

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `theme` | `Ref<ThemeMode>` | 当前主题模式，`'system'` 表示跟随系统 |
| `resolvedTheme` | `Readonly<Ref<ResolvedTheme>>` | 实际生效的明暗（`system` 已解析为 `light` / `dark`） |
| `setTheme(t)` | `(t: ThemeMode) => void` | 设置主题并持久化 |
| `toggleTheme()` | `() => void` | 在 `light` / `dark` 之间切换 |

## 特性

- **模块级单例**：任意多个组件调用 `useTheme()` 共享同一份状态，切换一处全局生效。
- **持久化**：写入 `localStorage['ai-chat-theme']`，刷新后保留。
- **跟随系统**：`theme = 'system'` 时监听 `prefers-color-scheme`，系统切换自动跟随。
- **自动应用**：把解析后的明暗写入 `<html data-theme="...">`，组件令牌自动翻转。
- **SSR 安全**：所有 `window` / `localStorage` 访问都有 `typeof window` 守卫，可在 `<script setup>` 中直接调用。

## 示例

点击按钮在亮 / 暗之间切换（会切换整页主题）：

<script setup>
import { useTheme } from '@ai-chat/vue'
const { resolvedTheme, toggleTheme } = useTheme()
</script>

<Button type="primary" @click="toggleTheme">
  当前：{{ resolvedTheme === 'dark' ? '🌙 暗色（点击切亮）' : '☀ 亮色（点击切暗）' }}
</Button>

```vue
<script setup lang="ts">
import { useTheme } from '@ai-chat/vue'

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

## 相关

- [主题定制指南](/guide/theming)：三层令牌结构、Props 配置、CSS 变量覆盖。
- [主题配置器](/theme-builder)：可视化调整全部令牌并导出 CSS 覆盖文件。
- [useThemePreset](/composables/use-theme-preset)：把预设 / 自定义变量应用到指定容器。
