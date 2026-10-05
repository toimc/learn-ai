# useClipboard

剪贴板复制的响应式包装。内部调用 `@toimc/core` 的 `copyText`（安全上下文优先 `navigator.clipboard`，失败或不可用时降级 `textarea` + `execCommand`），在成功后维护 `copied` 状态并在延时后自动复位——适合「复制成功 ✓」这类瞬时反馈 UI。

## 适用场景

| 场景 | 说明 |
|------|------|
| 复制按钮的瞬时反馈 | 点复制后按钮变 ✓、1.5s 自动复位，复位窗口内重复复制会重置计时 |
| 代码块 / 分享链接复制 | 任何需要把一段文本送进剪贴板并给用户确认反馈的宿主交互 |
| 非安全上下文兜底 | http 环境 `navigator.clipboard` 不可用时自动降级 `execCommand`，调用方无感 |

**典型消费组件**：[MessageActionCopy](/components/message-actions)（预设复制操作；其内部直接用 core 的 `copyText` 实现同款 `copied` 回显——自建复制按钮时用本 composable 可少写状态与定时器逻辑）。

## 代码演示

<script setup lang="ts">
import { useClipboard } from '@toimc/vue'

const { copied, copy } = useClipboard()
</script>

点击复制，按钮回显 ✓ 约 1.5 秒后自动复位：

<DemoContainer>
  <button
    type="button"
    style="
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid var(--ai-chat-color-border);
      background: var(--ai-chat-color-bg-primary);
      color: var(--ai-chat-color-text-primary);
      cursor: pointer;
    "
    @click="copy('AI Chat UI')"
  >
    {{ copied ? '已复制 ✓' : '复制文本' }}
  </button>
</DemoContainer>

## 函数签名

```typescript
function useClipboard(resetDelay?: number): {
  copied: Ref<boolean>
  copy: (text: string) => Promise<boolean>
}
```

## 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `resetDelay` | `number` | `1500` | 复制成功后 `copied` 保持 `true` 的毫秒数，到期自动复位为 `false` |

## 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `copied` | `Ref<boolean>` | 最近一次复制是否成功（成功后延时复位） |
| `copy` | `(text: string) => Promise<boolean>` | 执行复制，透传文本给 core `copyText`；成功返回 `true`，失败/空串返回 `false`，不抛异常 |

## 行为

- 复制成功后 `copied` 置 `true`，并在 `resetDelay` 毫秒后复位；复位窗口内再次复制会**重置计时器**。
- 复制失败（含空串、非浏览器环境、全链路降级失败）时 `copied` 保持 `false`，不安排复位。
- 在组件内使用时，作用域销毁（组件卸载）自动清理复位定时器；组件外裸调用同样可用（跳过清理注册，不产生告警）。
- 复制降级链的具体行为（安全上下文检测、`execCommand` 降级）是 `@toimc/core` `copyText` 的职责，本 composable 只做响应式状态。

## 示例

```vue
<script setup lang="ts">
import { useClipboard } from '@toimc/vue'

const { copied, copy } = useClipboard()

async function onCopy(text: string) {
  const ok = await copy(text)
  if (!ok) {
    // 复制失败兜底（如提示用户手动复制）
  }
}
</script>

<template>
  <button @click="onCopy('要复制的文本')">
    {{ copied ? '已复制' : '复制' }}
  </button>
</template>
```

消息操作按钮（复制/重试等）中的「复制成功 ✓」反馈即此模式：`copied` 驱动图标切换，`resetDelay` 控制回弹时长。

## 相关

- [ConversationScrollBtn](/components/conversation-scroll-btn)：未读角标与回到底部。
- [Conversation 系列](/components/conversation)：对话容器组件。
