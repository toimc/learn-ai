# 主题定制

AI Chat UI 使用 CSS Variables 实现主题定制，不依赖任何 CSS 框架。所有变量以 `--ai-chat-` 为前缀。

> 想可视化地调整主题？请打开 [主题配置器](/theme-builder) —— 所有三层令牌均可在线编辑、实时预览，并支持导出 CSS 覆盖文件。

## 三层令牌结构

主题系统采用 **原始 → 语义 → 组件** 的三层令牌结构。三层各司其职，改一层不会波及其余：

| 层 | 职责 | 是否随主题翻转 | 示例 |
|----|------|----------------|------|
| **原始 Primitive** | 主题无关的原材料（色阶、圆角、字体、尺寸） | 否（不进 `[data-theme]`） | `--ai-chat-color-accent-500`、`--ai-chat-neutral-100` |
| **语义 Semantic** | 按用途命名的颜色，亮色在 `:root`、暗色在 `[data-theme='dark']` 翻转 | 是 | `--ai-chat-color-bg-primary`、`--ai-chat-color-text-primary` |
| **组件 Component** | 组件级映射，引用语义层 | 否（引用而非取色） | `--ai-chat-bubble-radius` |

**核心原则**：组件只引用语义层，语义层引用原始层。换主题时只翻转语义层，原始层不动；换品牌色时只改原始层 accent 色阶，语义层自动跟随。

## 三档配置方式

从高到低三种方式，可叠加使用，优先级递增：

### 1. Props 声明式（组件级，推荐起步方式）

通过 `Conversation` 的三个 Props 直接声明，作用于容器内部，不影响全局：

```vue
<Conversation theme="purple" :custom-theme="{ '--ai-chat-color-accent-500': '#8b5cf6' }" dark-mode="dark">
  <!-- ... -->
</Conversation>
```

- `theme`：内置预设名（`default` / `purple` / `green` / `warm`），只改原始层 accent 色阶。
- `custom-theme`：自定义 CSS 变量键值对象，覆盖任意层令牌。
- `dark-mode`：`true` / `false` 强制本容器明暗；`'auto'`（默认）跟随全局。

> Props 以 inline style 应用到容器根元素，优先级最高，适合隔离的多实例场景。

### 2. useTheme 运行时切换（全局）

通过 `useTheme` composable 在运行时切换全局明暗，状态自动持久化到 `localStorage`，并写入 `document.documentElement` 的 `data-theme`：

```vue
<script setup lang="ts">
import { useTheme } from '@ai-chat/vue'

const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
// theme: 'light' | 'dark' | 'system'
// resolvedTheme: 实际解析后的 'light' | 'dark'
</script>

<template>
  <button @click="toggleTheme">
    当前：{{ resolvedTheme }}
  </button>
</template>
```

`useTheme` 是模块级单例，多个组件共享同一份状态。完整 API（返回值、类型、SSR 注意事项）见 [useTheme 文档](/composables/use-theme)；预设与自定义变量的容器级应用见 [useThemePreset 文档](/composables/use-theme-preset)。

### 3. CSS 覆盖（宿主零 JS）

直接在自己的 CSS 里重定义变量，组件会自动跟随。适合全站统一定制：

```css
:root {
  --ai-chat-color-accent-500: #7c3aed; /* 改原始层，语义层自动跟随 */
}
```

## 内置预设

内置四套预设，只覆盖原始层 accent 色阶，暗色与亮色天然兼容：

| 预设 key | 名称 | 主色 |
|----------|------|------|
| `default` | 默认靛蓝 | `#6366f1` |
| `purple` | 优雅紫 | `#8b5cf6` |
| `green` | 自然绿 | `#059669` |
| `warm` | 暖橙 | `#ea580c` |

```ts
import { presets, type PresetKey } from '@ai-chat/vue'

const purple = presets.purple // { name: '优雅紫', vars: {...} }
```

## 常用语义变量参考

下表列出最常用的语义层变量（完整目录见 [主题配置器](/theme-builder)，~45 个令牌均可视化编辑）。

### 强调色

| 变量名 | 亮色默认 | 说明 |
|--------|----------|------|
| `--ai-chat-color-accent` | `var(--ai-chat-color-accent-500)` | 主色 |
| `--ai-chat-color-accent-hover` | `#818cf8` | 主色悬停 |
| `--ai-chat-color-accent-dim` | `rgba(99,102,241,0.15)` | 主色淡底 |

### 背景

| 变量名 | 亮色默认 | 暗色默认 | 说明 |
|--------|----------|----------|------|
| `--ai-chat-color-bg-primary` | `#ffffff` | `#171717` | 主背景 |
| `--ai-chat-color-bg-secondary` | `#f9fafb` | `#262626` | 次背景 |
| `--ai-chat-color-bg-chat` | `#ffffff` | `#171717` | 聊天区背景 |
| `--ai-chat-color-bg-sidebar` | `#f9fafb` | `#171717` | 侧边栏背景 |

### 文本

| 变量名 | 亮色默认 | 暗色默认 | 说明 |
|--------|----------|----------|------|
| `--ai-chat-color-text-primary` | `#171717` | `#f9fafb` | 主文本 |
| `--ai-chat-color-text-secondary` | `#4b5563` | `#a1a1aa` | 次文本 |
| `--ai-chat-color-text-muted` | `#9ca3af` | `#71717a` | 弱文本 |

### 边框与输入

| 变量名 | 亮色默认 | 暗色默认 | 说明 |
|--------|----------|----------|------|
| `--ai-chat-color-border` | `#e5e7eb` | `#2e2e2e` | 边框 |
| `--ai-chat-color-input-bg` | `#f3f4f6` | `#2f2f2f` | 输入框背景 |
| `--ai-chat-color-input-border` | `#d1d5db` | `#404040` | 输入框边框 |

### 消息

| 变量名 | 亮色默认 | 暗色默认 | 说明 |
|--------|----------|----------|------|
| `--ai-chat-color-msg-user-bg` | `#f3f4f6` | `#2f2f2f` | 用户消息背景 |
| `--ai-chat-color-msg-assistant-bg` | `transparent` | `transparent` | AI 消息背景 |

### 状态色

| 变量名 | 亮色默认 | 暗色默认 | 说明 |
|--------|----------|----------|------|
| `--ai-chat-color-status-error` | `#ef4444` | `#f87171` | 错误 |
| `--ai-chat-color-status-warning` | `#f59e0b` | `#fbbf24` | 警告 |
| `--ai-chat-color-status-success` | `#10b981` | `#34d399` | 成功 |

### 组件

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-bubble-radius` | `var(--ai-chat-radius-lg)` | 气泡圆角（引用原始层） |

## 使用方式

### 全局覆盖

在根样式中重定义变量：

```css
:root {
  --ai-chat-color-accent-500: #7c3aed; /* 改原始层主色，语义层自动跟随 */
}
```

### 组件级覆盖

通过父容器限定作用域，只影响该容器内的组件：

```css
.my-chat {
  --ai-chat-color-bg-chat: #ecfdf5;
  --ai-chat-color-msg-user-bg: #d1fae5;
}
```

```vue
<Conversation class="my-chat">
  <!-- ... -->
</Conversation>
```

### 暗色模式

默认亮色（`:root`），暗色通过 `[data-theme='dark']` 翻转语义层：

```css
[data-theme='dark'] {
  --ai-chat-color-bg-primary: #0a0a0a;
  --ai-chat-color-text-primary: #f9fafb;
}
```

通常无需手写——组件库已内置完整的暗色语义层，调用 `toggleTheme()` 或在 `<html>` 上设 `data-theme="dark"` 即可。
