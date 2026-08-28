# MessageList

> ⚠️ **已废弃**：请迁移到 [ConversationContent](/components/conversation) 内直接 `v-for` 渲染消息。本组件保留导出仅为向后兼容。

渲染消息列表，通过作用域插槽自定义每条消息的渲染方式。

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'

const messages = ref([
  { id: '1', role: 'user', content: '你好，请帮我写一段代码', createdAt: new Date() },
  { id: '2', role: 'assistant', content: '好的，这是你要的代码示例。', createdAt: new Date() },
  { id: '3', role: 'user', content: '谢谢！', createdAt: new Date() },
])
</script>

<DemoContainer>
  <MessageList :messages="messages" v-slot="{ message }">
    <MessageBubble :message="message">
      <MarkdownRenderer :content="message.content" />
    </MessageBubble>
  </MessageList>
</DemoContainer>

## 作用域插槽

`MessageList` 通过作用域插槽暴露每条消息对象：

```vue
<MessageList :messages="chat.messages" v-slot="{ message }">
  <MessageBubble :message="message">
    <MarkdownRenderer :content="message.content" />
  </MessageBubble>
</MessageList>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| messages | `Message[]` | — | 消息列表（必填） |

### Slots

| 插槽名 | 作用域数据 | 说明 |
|--------|------------|------|
| default | `{ message: Message }` | 每条消息的渲染插槽 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-message-gap | `12px` | 消息间距 |
