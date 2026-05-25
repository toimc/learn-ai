# MessageBubble

单条消息气泡，包含头像、内容和操作按钮三个区域。根据 `message.role` 自动应用不同样式。

## 基础用法

<script setup>
import type { Message } from '@ai-chat/core'

const userMsg: Message = {
  id: '1', role: 'user', content: '这是一条用户消息', createdAt: new Date(),
}
const assistantMsg: Message = {
  id: '2', role: 'assistant', content: '这是一条 **助手** 消息，支持 `Markdown`。', createdAt: new Date(),
}
</script>

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <MessageBubble :message="userMsg">
      <MarkdownRenderer :content="userMsg.content" />
    </MessageBubble>
    <MessageBubble :message="assistantMsg">
      <MarkdownRenderer :content="assistantMsg.content" />
    </MessageBubble>
  </div>
</DemoContainer>

## 自定义头像

使用 `avatar` 插槽替换默认头像：

```vue
<MessageBubble :message="message">
  <template #avatar>
    <img src="/avatar.png" alt="avatar" style="width: 32px; height: 32px; border-radius: 50%" />
  </template>
  <MarkdownRenderer :content="message.content" />
</MessageBubble>
```

## 操作按钮

使用 `actions` 插槽添加操作按钮（悬停时可见）：

```vue
<MessageBubble :message="message">
  <MarkdownRenderer :content="message.content" />
  <template #actions>
    <button @click="copy(message.content)">复制</button>
    <button @click="retry(message.id)">重试</button>
  </template>
</MessageBubble>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| message | `Message` | — | 消息对象（必填） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| avatar | 头像区域（默认显示角色首字母） |
| default | 消息内容区域 |
| actions | 操作按钮区域（悬停可见） |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-bubble-radius | `12px` | 气泡圆角 |
| --ai-chat-user-bg | `#2563eb` | 用户消息背景 |
| --ai-chat-user-color | `#ffffff` | 用户消息文字 |
| --ai-chat-assistant-bg | `#f3f4f6` | 助手消息背景 |
| --ai-chat-assistant-color | `#1f2937` | 助手消息文字 |
