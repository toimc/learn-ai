# ChatWindow

> ⚠️ **已废弃**：请迁移到 [Conversation](/components/conversation) + ConversationContent 组合。本组件保留导出仅为向后兼容。

聊天窗口布局容器，提供可滚动的消息区域和固定底部区域。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import type { Message } from '@toimc/core'
import { Button, ChatWindow, MessageBubble } from '@toimc/vue'

let seq = 2
const draft = ref('')
const messages = ref<Message[]>([
  {
    id: 'm1',
    role: 'user',
    content: 'ChatWindow 还能继续用吗？',
    createdAt: new Date(),
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      '可以。它保留导出仅为向后兼容，新项目建议直接用 Conversation 系列组合。',
    createdAt: new Date(),
  },
])

function send() {
  const text = draft.value.trim()
  if (!text) return
  seq += 1
  messages.value.push({
    id: `m${seq}`,
    role: 'user',
    content: text,
    createdAt: new Date(),
  })
  draft.value = ''
  const reply = seq + 1
  setTimeout(() => {
    messages.value.push({
      id: `m${reply}`,
      role: 'assistant',
      content: `（模拟回复）收到：${text}`,
      createdAt: new Date(),
    })
    seq = reply
  }, 600)
}
</script>

输入消息后点击发送（或回车），消息区追加气泡，底部区域固定不动：

<DemoContainer>
  <ChatWindow height="360px">
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px">
      <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg">
        {{ msg.content }}
      </MessageBubble>
    </div>
    <template #footer>
      <div
        style="
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid #e5e7eb;
        "
      >
        <input
          v-model="draft"
          placeholder="输入消息，回车发送"
          style="
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            outline: none;
          "
          @keyup.enter="send"
        />
        <Button type="primary" @click="send">发送</Button>
      </div>
    </template>
  </ChatWindow>
</DemoContainer>

## 自定义高度

通过 `height` prop 设置窗口高度：

```vue
<ChatWindow height="500px">
  <!-- ... -->
</ChatWindow>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| height | `string` | `'100%'` | 窗口高度（CSS 值） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 消息内容区域（可滚动） |
| footer | 底部区域，通常放置 PromptInput 输入组件 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-border-color | `#e5e7eb` | 边框颜色 |
| --ai-chat-radius | `8px` | 圆角大小 |
| --ai-chat-bg | `#ffffff` | 背景颜色 |
| --ai-chat-padding | `16px` | 内边距 |
