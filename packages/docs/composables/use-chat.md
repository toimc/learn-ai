# useChat

核心 composable，管理聊天状态和消息流。

## 函数签名

```typescript
function useChat(
  adapter: ChatAdapter,
  options?: ChatOptions
): UnwrapNestedRefs<ChatState>
```

## 参数

### ChatAdapter

```typescript
interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
  abort?(requestId: string): void
  getHistory?(options: HistoryOptions): Promise<Message[]>
}
```

### ChatOptions

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| initialMessages | `Message[]` | `[]` | 初始消息列表 |
| maxHistory | `number` | — | 最大消息数量，超出删除最早的 |
| onError | `(error: Error) => void` | — | 错误回调 |
| onResponse | `(chunk: StreamChunk) => void` | — | 每个 chunk 回调 |

## 返回值 (ChatState)

| 属性名 | 类型 | 说明 |
|--------|------|------|
| messages | `Message[]` | 消息列表（响应式） |
| isStreaming | `boolean` | 是否正在流式输出 |
| error | `Error \| null` | 最近一次错误（含**零产出守卫**：流正常结束但无任何文本/思考/工具产出时置「回复为空：上游未返回内容，请检查模型服务配置」——坏 key 的中转站空回复即此形态，中断不算错误） |
| send | `(content: string, attachments?: Attachment[]) => Promise<void>` | 发送消息 |
| abort | `() => void` | 中止当前流式输出 |
| clear | `() => void` | 清空所有消息和错误 |

> 💡 流式期间 assistant 消息的 `content` / `thinking` / `toolCalls` 均为**实时响应式更新**——每个 chunk 到达即触发界面重渲染，可直接绑定到模板做逐字输出效果。

## 完整示例

<script setup>
import { ref } from 'vue'
import { useChat } from '@toimc/core'
import { mockAdapter } from '@toimc/playground'

const chat = useChat(mockAdapter)
const errorInfo = ref('')
</script>

<DemoContainer>
  <div>
    <div style="margin-bottom: 8px; font-size: 14px; color: #666">
      状态: {{ chat.isStreaming ? '流式中...' : '空闲' }}
      <span v-if="chat.error" style="color: #ef4444"> | 错误: {{ chat.error.message }}</span>
    </div>
    <ChatWindow style="height: 300px">
      <MessageList v-slot="{ message }" :messages="chat.messages">
        <MessageBubble :message="message">
          <MarkdownRenderer :content="message.content" />
        </MessageBubble>
      </MessageList>
      <template #footer>
        <PromptInput
          :disabled="chat.isStreaming"
          send-key="enter"
          @send="(payload) => chat.send(payload.text)"
          @abort="chat.abort"
        >
          <PromptInputBody>
            <PromptInputTextarea />
            <PromptInputSubmit />
          </PromptInputBody>
        </PromptInput>
      </template>
    </ChatWindow>
    <div style="margin-top: 8px; display: flex; gap: 8px">
      <Button size="small" type="secondary" @click="chat.clear">清空消息</Button>
      <span style="font-size: 14px; color: #666; line-height: 32px">消息数: {{ chat.messages.length }}</span>
    </div>
  </div>
</DemoContainer>

## 相关类型

### Message

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  createdAt: Date
}
```

### StreamChunk

```typescript
interface StreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: Record<string, unknown>
}
```

### Attachment

```typescript
interface Attachment {
  type: 'image' | 'file' | 'audio'
  url: string
  name: string
  mimeType: string
  size?: number
}
```
