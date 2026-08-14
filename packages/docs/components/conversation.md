# Conversation 系列

对话容器组件，提供滚动管理和自动吸底功能。包含 4 个子组件：

- **Conversation** — 根容器，provide 滚动上下文
- **ConversationContent** — 可滚动消息区，max-width 768px 居中
- **ConversationEmpty** — 欢迎屏（空对话占位）
- **ConversationScrollBtn** — 回到底部浮动按钮

## 基础用法

<DemoContainer>
  <div style="height: 400px; border-radius: 12px; overflow: hidden; border: 1px solid var(--vp-c-divider);">
    <Conversation>
      <ConversationContent>
        <ConversationEmpty>
          <div style="text-align: center; padding: 48px 24px;">
            <h3 style="margin-bottom: 8px;">欢迎使用 AI Chat UI</h3>
            <p style="color: var(--vp-c-text-2);">发送一条消息开始对话</p>
          </div>
        </ConversationEmpty>
      </ConversationContent>
    </Conversation>
  </div>
</DemoContainer>

## 与 useChat 组合

```vue
<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import {
  Conversation, ConversationContent, ConversationEmpty
} from '@ai-chat/vue'

const chat = useChat(adapter)
</script>

<template>
  <Conversation>
    <ConversationContent>
      <ConversationEmpty v-if="chat.messages.length === 0">
        <h3>有什么可以帮你的？</h3>
      </ConversationEmpty>

      <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
        <MessageContent>{{ msg.content }}</MessageContent>
      </Message>
    </ConversationContent>
  </Conversation>
</template>
```

## API

### Conversation

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| layout | `'stacked' \| 'im'` | `'stacked'` | 消息对齐模式：`stacked` 统一靠左（现状）；`im` 用户与 AI 分列两侧 |
| messageAlign | `'left' \| 'right'` | `'left'` | `im` 模式下用户消息停靠侧（AI 在对侧）；`stacked` 下不生效 |
| autoScroll | `boolean` | `true` | 新消息自动吸底 |
| theme | `PresetKey` | — | 内置预设名（`default` / `purple` / `green` / `warm`） |
| customTheme | `Record<string, string>` | — | 自定义 CSS 变量键值对象 |
| darkMode | `boolean \| 'auto'` | `'auto'` | 容器级明暗：`true` / `false` 强制，`'auto'` 跟随全局 |

通过 `provide` 把滚动上下文与消息布局上下文下发给子组件。

### ConversationContent

消息区默认 `max-width: var(--ai-chat-content-max-width)` 居中，四周留白 24px（底部留白用于与输入区隔开）；容器宽度 ≥ 1100px 时经容器查询自动放宽到 `--ai-chat-content-max-width-wide`（宽屏显示更宽的消息）。

| 插槽名 | 说明 |
|--------|------|
| default | 消息内容区域 |

### ConversationEmpty

| 插槽名 | 说明 |
|--------|------|
| default | 空状态内容（欢迎屏） |

### ConversationScrollBtn

| 事件名 | 说明 |
|--------|------|
| click | 用户点击回到底部按钮 |
