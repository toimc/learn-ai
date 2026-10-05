# useLayoutConfig

结构化布局配置 composable：把响应式宽度、消息对齐等布局参数映射为 CSS 变量与组件 props，统一喂给 [`Conversation`](/components/conversation)。

## 适用场景

| 场景 | 说明 |
|------|------|
| 可配置的布局面板 | 用户在设置面板拖动宽度 / 选择对齐方式，`vars` 响应式重算，界面即时生效 |
| 响应式宽度策略 | 内容最大宽度、消息气泡上限、输入框高度等收敛为一份结构化配置，避免散落的 style |
| 布局与主题解耦 | 尺寸走 CSS 变量（喂 `customTheme`）、结构走 `layoutProps`（喂 `layout` / `messageAlign`），两条通道不混写 |

**典型消费组件**：[Conversation](/components/conversation)——`vars` 喂给其 `customTheme`，`layoutProps` 喂给 `layout` / `messageAlign` Props。

## 签名

```ts
function useLayoutConfig(
  config: MaybeRefOrGetter<LayoutConfig>,
): {
  /** 尺寸类配置 → CSS 变量字典，喂给 Conversation.customTheme */
  vars: ComputedRef<Record<string, string>>
  /** 结构类配置，透传给 Conversation.layout / messageAlign */
  layoutProps: ComputedRef<{ layout?: MessageLayout; messageAlign?: MessageAlign }>
  /** 当前生效配置 */
  state: ComputedRef<LayoutConfig>
}
```

## LayoutConfig

| 字段 | 类型 | 映射目标 |
|------|------|----------|
| `contentMaxWidth` | `number` | `--ai-chat-content-max-width` |
| `contentMaxWidthWide` | `number` | `--ai-chat-content-max-width-wide` |
| `messageMaxWidth` | `number` | `--ai-chat-message-max-width` |
| `inputMaxHeight` | `number` | `--ai-chat-input-max-height` |
| `inputMaxHeightMobile` | `number` | `--ai-chat-input-max-height-mobile` |
| `breakpointSm` | `number` | `--ai-chat-breakpoint-sm` |
| `breakpointMd` | `number` | `--ai-chat-breakpoint-md` |
| `breakpointLg` | `number` | `--ai-chat-breakpoint-lg` |
| `breakpointXl` | `number` | `--ai-chat-breakpoint-xl` |
| `layout` | `'stacked' \| 'im'` | 透传 `Conversation.layout` |
| `messageAlign` | `'left' \| 'right'` | 透传 `Conversation.messageAlign` |

## 用法

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Conversation, ConversationContent, Message, useLayoutConfig } from '@toimc/vue'

const layoutMode = ref<'stacked' | 'im'>('stacked')
const layout = useLayoutConfig(
  computed(() => ({
    layout: layoutMode.value,
    messageAlign: 'right',          // im 模式下用户消息靠右
    contentMaxWidthWide: 1024,      // 宽屏消息区放宽
    messageMaxWidth: 520,           // im 模式气泡限宽
  })),
)
</script>

<template>
  <Conversation
    :layout="layout.layoutProps.value.layout"
    :message-align="layout.layoutProps.value.messageAlign"
    :custom-theme="layout.vars.value"
  >
    <ConversationContent>
      <Message from="user">用户消息</Message>
      <Message from="assistant">AI 回复</Message>
    </ConversationContent>
  </Conversation>
</template>
```

## 设计要点

- **不直接写 DOM**：`vars` 是纯 CSS 变量字典，交给 `Conversation.customTheme`，经 `useThemePreset` 单点写入容器（全组件唯一 inline-style 写入点），避免多写入点互相覆盖。
- **结构配置分离**：`layout` / `messageAlign` 不变量化，作为 `layoutProps` 返回，透传给 `Conversation` 的同名 prop。
- **ThemeBuilder 联动**：映射的 CSS 变量均已登记进 `tokensMeta`，可在[主题配置器](/theme-builder)可视化调整。
- **CSS 容器查询限制**：容器查询条件（如 `@container (min-width: 1100px)`）不支持 `var()`，故 `breakpointSm/Md/Lg` 等变量仅作语义参考，实际断点在 CSS 中为字面量。
