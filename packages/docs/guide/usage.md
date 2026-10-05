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
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: {
    toolCallId?: string                  // 工具调用 id（tool_call/tool_result 关联）
    toolName?: string
    toolArguments?: Record<string, unknown>
    toolResult?: unknown
    toolError?: string
    duration?: number
    [key: string]: unknown               // done 帧可回传 usage 等宿主扩展
  }
}
```

## 思考过程支持

AI Chat UI 支持展示模型的思考过程，让用户了解 AI 的推理步骤。

### 在适配器中添加 thinking chunk

```typescript
export const adapterWithThinking: ChatAdapter = {
  async *sendMessage({ messages, signal }) {
    // 1. 发送思考过程
    yield { type: 'thinking', content: '正在分析用户请求...\n' }
    await new Promise(r => setTimeout(r, 100))
    
    yield { type: 'thinking', content: '拆解问题为关键概念...\n' }
    await new Promise(r => setTimeout(r, 100))
    
    yield { type: 'thinking', content: '考虑最佳实践和性能影响...\n' }
    
    // 2. 发送实际响应
    yield { type: 'text', content: '根据分析，这里是关键概念：\n\n' }
    
    // 3. 完成
    yield { type: 'done', content: '' }
  },
}
```

### 组件中使用思考过程

```vue
<template>
  <MessageContent
    :content="message.content"
    :thinking="message.thinking"
    :streaming="chat.isStreaming"
  />
</template>
```

### Message 类型扩展

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: ThinkingInfo      // 思考过程信息
  sources?: MessageSource[]    // RAG/检索引用来源（Sources/InlineCitation 消费）
  comparison?: ComparisonPayload // A/B 回复对比载荷（消息类型驱动渲染）
  // ... 其他字段
}

interface ThinkingInfo {
  content: string          // 思考内容
  duration?: number        // 思考耗时（毫秒）
  startTime?: Date         // 思考开始时间
  active?: boolean         // 思考是否仍在进行（useChat 流式期间维护）
  steps?: ThinkingStep[]   // 结构化多步骤思维链（ThinkingChain 消费，可选渐进增强）
}

interface ThinkingStep {
  id: string
  title: string
  status: 'pending' | 'active' | 'complete' | 'error'
  content?: string         // 步骤详情
  duration?: number        // 单步耗时（毫秒）
}

interface MessageSource {
  id: string
  type: 'url' | 'document'
  title?: string
  url?: string              // type==='url' 时由渲染组件校验 http(s) 白名单
  snippet?: string          // 原文引用片段
  metadata?: Record<string, unknown> // 相关性分数/页码/作者等附加信息
}

interface ComparisonPayload {
  left: string             // 候选 A 内容（markdown）
  right: string            // 候选 B 内容（markdown）
  leftLabel?: string       // 左列标题
  rightLabel?: string      // 右列标题
}
```

#### 工具调用状态机

`ToolCallInfo.status` 为六态生命周期（向后兼容，旧三值语义不变）：

```typescript
type ToolCallStatus =
  | 'pending'            // 排队/参数流式组装中
  | 'calling'            // 执行中
  | 'awaiting-approval'  // 等待人工审批（ToolConfirmation 组件消费）
  | 'completed'          // 完成
  | 'denied'             // 用户拒绝
  | 'error'              // 失败
```

### 自动计算思考耗时

`useChat` 会自动计算思考耗时：

```typescript
// 在 useChat 中自动处理
if (chunk.type === 'thinking') {
  if (!assistantMessage.thinking) {
    assistantMessage.thinking = {
      content: '',
      startTime: new Date(),
    }
  }
  assistantMessage.thinking.content += chunk.content
}

// done 时计算耗时
if (chunk.type === 'done') {
  if (assistantMessage.thinking && thinkingStartTime) {
    assistantMessage.thinking.duration = Date.now() - thinkingStartTime
  }
}
```

详细用法请参考 [Message 组件文档](../components/message.md#思考过程)。

## 实现 OpenAI 兼容适配器

```typescript
import type { ChatAdapter, StreamChunk } from '@toimc/core'

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
import type { ChatAdapter } from '@toimc/core'

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
import { useChat } from '@toimc/core'

const chat = useChat(adapter, {
  // 可选配置
  initialMessages: [],          // 初始消息列表
  maxHistory: 100,              // 最大消息数
  maxContextTokens: 8000,       // 上下文窗口（token），超出截断最旧消息；支持 getter 随选中模型变化
  tokenEstimator: (text) => 0,  // 可注入的 token 估算器，默认 estimateTokens
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
| `truncatedCount` | `number` | 因上下文窗口被截断的消息数 |
| `send` | `(content, attachments?) => Promise<void>` | 发送消息 |
| `regenerate` | `(messageId?) => Promise<void>` | 重新生成：删除目标 assistant 消息及其后所有消息后重发 |
| `editMessage` | `(messageId, content) => Promise<void>` | 编辑用户消息：覆盖内容后以新内容重发 |
| `abort` | `() => void` | 中止当前流式输出 |
| `clear` | `() => void` | 清空所有消息 |

## 组件组装

### AI 场景组件总览

AI 场景组件均已从 `@toimc/vue` 主入口导出，按能力域分组：

| 能力域 | 组件 | 文档 |
|---|---|---|
| RAG 引用 | `InlineCitation`（行内角标轮播卡）、`Sources`（来源列表/徽标） | [inline-citation](../components/inline-citation.md) / [sources](../components/sources.md) |
| 思维链 | `ThinkingChain`（多步骤时间线，与 `ThinkingBlock` 单块互补） | [thinking-chain](../components/thinking-chain.md) |
| 工具审批 | `ToolConfirmation`（approve/reject 审批卡）、六态 `ToolCallHeader` | [tool-confirmation](../components/tool-confirmation.md) |
| 欢迎引导 | `Welcome`（富欢迎页）、`Prompts`（提示词面板） | [welcome](../components/welcome.md) / [prompts](../components/prompts.md) |
| 消息操作 | `MessageFeedback`（点赞点踩+评论）、`MessageActionCopy/Retry/Edit/Feedback`、`BranchPicker`（分支翻页） | [message-feedback](../components/message-feedback.md) / [message-actions](../components/message-actions.md) / [branch-picker](../components/branch-picker.md) |
| 模型元数据 | `ModelIcon`（15 厂商品牌图标）、`JsonDiffView`（JSON 差异） | [model-icon](../components/model-icon.md) / [json-diff-view](../components/json-diff-view.md) |
| 输入增强 | `PromptInputSuggestion`（@/斜杠内联建议浮层）、`useClipboard`（复制降级） | [prompt-input-suggestion](../components/prompt-input-suggestion.md) |
| markdown | `CodeBlock` 行号/折叠、`formula-guard` 公式容错（内部管线自动生效） | [code-block](../components/code-block.md) |

配套 core 纯函数（`@toimc/core` 导出）：`detectModelVendor`/`groupModelsByVendor`（厂家识别）、`formatPerMillion`/`formatTokenCost`/`pricingTier`（定价格式化）、`copyText`（剪贴板降级）、`splitAtoms`/`joinAtoms`（md 原子化字节保真）。

```vue
<template>
  <Conversation>
    <!-- 消息列表 -->
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

    <!-- 输入区域 -->
    <PromptInput
      :disabled="chat.isStreaming"
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
</template>
```

## Core 工具函数

`@toimc/core` 除 `useChat` 等组合式 API 外，还提供一组与 UI 无关的纯函数工具，可直接从包入口导入。

### 模型厂家识别

```typescript
import { detectModelVendor, groupModelsByVendor } from '@toimc/core'

// 模型 id → 厂商信息（斜杠前缀如 openrouter 形态会先取末段再匹配）
detectModelVendor('deepseek-chat')
// { vendor: 'deepseek', label: 'DeepSeek', matchedBy: '^deepseek-' }
detectModelVendor('anthropic/claude-sonnet-4-5')
// { vendor: 'anthropic', label: 'Anthropic', matchedBy: '^claude-|^anthropic\\.claude-' }

// 批量分组：返回含全部厂商键的 Record，组内保持输入顺序，未命中归 unknown
groupModelsByVendor(['gpt-4o', 'deepseek-chat', 'mystery'])
// { openai: ['gpt-4o'], deepseek: ['deepseek-chat'], unknown: ['mystery'], ... }
```

- `ModelVendor` 枚举：`openai / anthropic / google / zhipu / qwen / deepseek / mistral / meta / cohere / yi / xai / moonshot / doubao / minimax / wenxin / unknown`
- `VendorInfo.label` 为品牌名（zh/en 同形，如 `'DeepSeek'`）；`unknown` 的 label 为空串，本地化文案由调用方注入
- `matchedBy` 为命中的正则 source（调试用），未命中时缺省
- 另导出 `VENDOR_ORDER`（展示顺序）与 `VENDOR_LABELS`（厂商名映射）

### 模型定价格式化

```typescript
import {
  formatPerMillion,
  formatTokenCost,
  pricingTier,
} from '@toimc/core'

// "$3.00/1M" 式单价展示；<0.01 用 4 位小数，未知返回 '—'
formatPerMillion(3) // '$3.00/1M'
formatPerMillion(0.0024) // '$0.0024/1M'
formatPerMillion(15, '¥') // '¥15.00/1M'
formatPerMillion(undefined) // '—'

// 按 token 用量计一次对话成本（缺省侧价格不参与计算）
formatTokenCost(
  { inputPerMTokens: 3, outputPerMTokens: 15 },
  1_000_000,
  1_000_000,
) // '$18.00'

// 价格档位：按 input/output 已知价的均价划档
pricingTier({ inputPerMTokens: 0 }) // 'free'
pricingTier({ inputPerMTokens: 0.3 }) // 'economy'
pricingTier({ inputPerMTokens: 5 }) // 'standard'
pricingTier({ inputPerMTokens: 12 }) // 'premium'
```

- `ModelPricing`：`inputPerMTokens` / `outputPerMTokens`（$/1M token，缺省视为未知不参与计算）+ 可选 `currency`（默认 `'$'`）
- 档位阈值（$/1M 均价）：`0` → free、`<1` → economy、`<10` → standard、`≥10` → premium；价格全未知返回中性 `standard`
- 数字格式固定 en-US（千分位分组）；档位标签的本地化翻译由消费方按 tier → `t()` 映射

### 剪贴板复制 copyText

```typescript
import { copyText } from '@toimc/core'

const ok = await copyText('要复制的文本')
```

- 降级链：安全上下文（HTTPS/localhost）优先 `navigator.clipboard.writeText`，失败或不可用时降级 `textarea + document.execCommand('copy')`
- 空字符串、非浏览器环境（SSR）、全链路失败均返回 `false`，不抛异常
- 需要响应式 `copied` 状态时用 vue 层的 `useClipboard` composable（内部基于 `copyText`）

### markdown 原子化切分

```typescript
import { splitAtoms, joinAtoms } from '@toimc/core'

const atoms = splitAtoms(md)
// [
//   { type: 'frontmatter', raw: '---\ntitle: t\n---\n', editable: false },
//   { type: 'text',        raw: '\n# 标题\n\n',        editable: true },
//   { type: 'math-block',  raw: '$$\nE=mc^2\n$$\n',     editable: false },
//   { type: 'fence',       raw: '```js\ncode\n```\n',   editable: false },
//   ...
// ]

joinAtoms(atoms) === md // 恒等：字节级往返保真
```

- `MdAtom.type`：`frontmatter`（字节 0 起的 `---` 块）/ `math-block`（`$$..$$`）/ `html-block`（`<details>` `<div>` `<table>` 等原生块）/ `fence`（``` 围栏）/ `text`（其余）
- `editable: false` 的结构块在编辑器场景整块直通，不可逐字编辑
- 红线保证：`joinAtoms(splitAtoms(md)) === md` 对任意输入成立（含 CRLF、段间空白、未闭合 fence/标签兜底），可直接用于编辑器往返
- 围栏内的 `$$`、`<div>` 等行一律视为代码内容，不会误识别为原子

## 语音输入与输出

Web Speech API 的浏览器原生封装，均从 `@toimc/vue` 导出，完整 API 与行为契约见[语音输入与输出](/guide/speech)：

```typescript
import { useSpeechInput, useSpeechOutput } from '@toimc/vue'

const input = useSpeechInput()          // 特性检测 supported + 状态机 + 实时字幕 interimText
const output = useSpeechOutput()        // 句子级 TTS：feedChunk 流式凑句朗读，enabled 默认关闭
```

- `useSpeechInput`：点击切换式单句识别（`continuous=false`），识别文本进输入框确认再发送；Firefox 等不支持时 `supported` 为 false 驱动按钮显隐
- `useSpeechOutput`：流式回复凑满一句读一句（`splitSentences` 切句），自动朗读开关默认关闭并经 localStorage 持久化；推荐经 `useChat` 的 `onResponse` 接入

