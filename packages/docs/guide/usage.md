# 使用指南

## ChatAdapter 接口

`ChatAdapter` 是连接 UI 组件与 AI 后端的桥梁。你只需要实现一个方法：

```typescript
interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
  abort?(requestId: string): void
  getHistory?(options: HistoryOptions): Promise<Message[]>
}
```

- **`sendMessage`**（必须）— 接收消息列表，返回 `AsyncGenerator<StreamChunk>` 流式输出
- **`abort`**（可选）— 中止正在进行的请求
- **`getHistory`**（可选）— 加载历史消息

## StreamChunk 类型

```typescript
interface StreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: Record<string, unknown>
}
```

## 实现 OpenAI 兼容适配器

```typescript
import type { ChatAdapter, StreamChunk } from '@ai-chat/core'

export const openaiAdapter: ChatAdapter = {
  async *sendMessage({ messages, signal }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal,
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          yield { type: 'done', content: '' }
          return
        }
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          yield { type: 'text', content }
        }
      }
    }
  },
}
```

## 实现简单 fetch 适配器

```typescript
import type { ChatAdapter } from '@ai-chat/core'

export const fetchAdapter: ChatAdapter = {
  async *sendMessage({ messages }) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield { type: 'text', content: decoder.decode(value) }
    }
    yield { type: 'done', content: '' }
  },
}
```

## useChat Composable

```typescript
import { useChat } from '@ai-chat/core'

const chat = useChat(adapter, {
  // 可选配置
  initialMessages: [],          // 初始消息列表
  maxHistory: 100,              // 最大消息数
  onError: (err) => {},         // 错误回调
  onResponse: (chunk) => {},    // 每个 chunk 回调
})
```

### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `messages` | `Message[]` | 消息列表（响应式） |
| `isStreaming` | `boolean` | 是否正在流式输出 |
| `error` | `Error \| null` | 最近一次错误 |
| `send` | `(content, attachments?) => Promise<void>` | 发送消息 |
| `abort` | `() => void` | 中止当前流式输出 |
| `clear` | `() => void` | 清空所有消息 |

## 组件组装

```vue
<template>
  <ChatWindow>
    <!-- 消息列表 -->
    <MessageList v-slot="{ message }" :messages="chat.messages">
      <MessageBubble :message="message">
        <MarkdownRenderer :content="message.content" />
      </MessageBubble>
    </MessageList>

    <!-- 输入区域 -->
    <template #footer>
      <PromptInput
        :disabled="chat.isStreaming"
        @send="(payload) => chat.send(payload.text)"
        @abort="chat.abort"
      >
        <PromptInputTextarea />
        <PromptInputSubmit />
      </PromptInput>
    </template>
  </ChatWindow>
</template>
```
