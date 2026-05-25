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

无 Props。作为容器使用，provide 滚动上下文给子组件。

### ConversationContent

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
