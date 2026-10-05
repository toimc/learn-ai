# useThemePreset

把主题**预设**与**自定义 CSS 变量**应用到指定容器（以 inline style 写入，优先级最高，覆盖 `:root` 默认与暗色翻转）。`Conversation` 组件内部用它实现 `theme` / `customTheme` 两个 Props，你也可以直接调用。

## 适用场景

| 场景 | 说明 |
|------|------|
| 多套主题预设切换 | 内置 default / purple / green / warm 四套预设，改 accent 原始层即整体换肤 |
| 宿主精确覆盖令牌 | 自定义 CSS 变量字典以 inline style 写入，无需 `!important` 即压过默认值 |
| 会话级换肤 | 每个会话容器独立应用不同预设，互不影响宿主页面 |

**典型消费组件**：[Conversation](/components/conversation)（内部用它实现 `theme` / `customTheme` Props，是全组件唯一的 inline-style 写入点）。参考消费方：playground 的主题配置器 `ThemeBuilder`。

## 函数签名

```typescript
function useThemePreset(
  containerRef: Ref<HTMLElement | undefined>,
  preset: Ref<PresetKey | undefined>,
  customVars: Ref<Record<string, string> | undefined>,
): void
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `containerRef` | `Ref<HTMLElement \| undefined>` | 目标容器（通常是组件根元素的 ref） |
| `preset` | `Ref<PresetKey \| undefined>` | 预设名：`default` / `purple` / `green` / `warm` |
| `customVars` | `Ref<Record<string, string> \| undefined>` | 任意 CSS 变量覆盖（键为 `--ai-chat-*`） |

## 类型

```typescript
export type PresetKey = 'default' | 'purple' | 'green' | 'warm'
```

## 行为

- `onMounted` 时应用一次，并对 `preset` / `customVars` 建立 `watch`，变化后重新应用。
- 仅清除本插件写入的原始层变量，**不会**清掉宿主自己的 inline style。
- 优先级：inline style（customVars / 预设）> `[data-theme='dark']` > `:root`，保证自定义不被暗色或默认覆盖。

## 示例

通常无需手动调用——直接用 `Conversation` 的 Props 即可：

```vue
<Conversation theme="purple" :custom-theme="{ '--ai-chat-color-accent-400': '#a78bfa' }" />
```

手动应用到任意容器：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useThemePreset, type PresetKey } from '@toimc/vue'

const root = ref<HTMLElement>()
const preset = ref<PresetKey>('purple')
const customVars = ref<Record<string, string>>({
  '--ai-chat-color-accent-400': '#a78bfa',
})
useThemePreset(root, preset, customVars)
</script>

<template>
  <div ref="root">此容器内的 --ai-chat-* 变量被预设与自定义值覆盖</div>
</template>
```

## 相关

- [主题定制指南](/guide/theming)：三档配置（Props / useTheme / CSS 覆盖）。
- [useTheme](/composables/use-theme)：全局明暗运行时切换。
- [主题配置器](/theme-builder)：在线生成 `customTheme` 变量并导出 CSS。
