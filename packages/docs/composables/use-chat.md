# useChat

核心 composable，管理聊天状态和消息流。

## 适用场景

| 场景 | 说明 |
|------|------|
| 接入任意后端 | 实现一个 `ChatAdapter`（mock / SSE / WebSocket 均可），useChat 负责其余全部状态管理，UI 层不写后端代码 |
| 流式对话界面 | `for await` 消费 `StreamChunk`，text / tool_call / thinking / error 分类落到响应式状态，配合 StreamText 等组件即得打字机效果 |
| 可中断的请求 | `stop()` 基于 AbortSignal 中断适配器流，中断不算错误、不残留错误消息 |
| 多会话应用 | 每个会话各自实例化一个 useChat，切换会话即切换状态集合 |

**典型消费组件**：无——useChat 是**应用层** composable，组件库不消费它；它产出的 `messages` / `streaming` / `error` 等状态由宿主传入 [Conversation](/components/conversation) / [Message](/components/message) 系列组件渲染。参考消费方：playground 的 `PlaygroundDemo`、`MockServerDemo`、`MultiAgentDemo`、`WorkflowDemo` 演示页。

## 代码演示

接 mock 适配器发送消息，观察流式状态、消息计数与清空——UI 层零后端代码：

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
    <div style="height: 300px; display: flex">
      <Conversation style="flex: 1">
        <ConversationContent>
          <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
            <MessageContent
              :content="msg.role === 'assistant' ? msg.content : undefined"
              :streaming="chat.isStreaming"
            >
              <template v-if="msg.role !== 'assistant'">{{ msg.content }}</template>
            </MessageContent>
          </Message>
        </ConversationContent>
        <PromptInput
          :disabled="chat.isStreaming"
          send-key="enter"
          @send="(payload) => chat.send(payload.text)"
          @abort="chat.abort"
        >
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <template #footer>
            <PromptInputFooter>
              <template #hint>
                <PromptInputSubmit />
              </template>
            </PromptInputFooter>
          </template>
        </PromptInput>
      </Conversation>
    </div>
    <div style="margin-top: 8px; display: flex; gap: 8px">
      <Button size="small" type="secondary" @click="chat.clear">清空消息</Button>
      <span style="font-size: 14px; color: #666; line-height: 32px">消息数: {{ chat.messages.length }}</span>
    </div>
  </div>
</DemoContainer>

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
| maxContextTokens | `number \| (() => number)` | — | 上下文窗口 token 上限（0 = 不限制），支持 getter 每次发送求值 |
| tokenEstimator | `(text: string) => number` | — | 自定义 token 估算函数 |
| onError | `(error: Error) => void` | — | 错误回调 |
| onResponse | `(chunk: StreamChunk) => void` | — | 每个 chunk 回调 |

## 返回值 (ChatState)

| 属性名 | 类型 | 说明 |
|--------|------|------|
| messages | `Message[]` | 消息列表（响应式） |
| isStreaming | `boolean` | 是否正在流式输出 |
| error | `Error \| null` | 最近一次错误（含**零产出守卫**：流正常结束但无任何文本/思考/工具产出时置「回复为空：上游未返回内容，请检查模型服务配置」——坏 key 的中转站空回复即此形态，中断不算错误） |
| truncatedCount | `number` | 当前发送窗口被截断的消息条数 |
| send | `(content: string, attachments?: Attachment[]) => Promise<void>` | 发送消息 |
| abort | `() => void` | 中止当前流式输出 |
| clear | `() => void` | 清空所有消息和错误 |
| regenerate | `(messageId?: string) => Promise<void>` | 重新生成 AI 消息（删除该消息及其后所有消息并重发，缺省为最后一条） |
| editMessage | `(messageId: string, content: string) => Promise<void>` | 编辑用户消息（覆盖原消息、删除其后回复并重发） |

> 💡 流式期间 assistant 消息的 `content` / `thinking` / `toolCalls` 均为**实时响应式更新**——每个 chunk 到达即触发界面重渲染，可直接绑定到模板做逐字输出效果。

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
