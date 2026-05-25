# ai-chat-ui P0 级组件设计方案

> 基于 Vercel AI Elements (elements.ai-sdk.dev) 组件架构分析，结合项目现状，制定 P0 级核心组件设计。

## 一、AI Elements 组件全景与 ai-chat-ui 映射

### AI Elements 组件分类

| 分类 | 组件数 | 组件列表 |
|------|--------|----------|
| **Chatbot** | 18 | Attachments, Chain of Thought, Checkpoint, Confirmation, Context, Conversation, Inline Citation, Message, Model Selector, Plan, Prompt Input, Queue, Reasoning, Shimmer, Sources, Suggestion, Task, Tool |
| **Code** | 14 | Agent, Artifact, Code Block, Commit, Environment Variables, File Tree, JSX Preview, Package Info, Sandbox, Schema Display, Snippet, Stack Trace, Terminal, Test Results, Web Preview |
| **Voice** | 6 | Audio Player, Mic Selector, Persona, Speech Input, Transcription, Voice Selector |
| **Workflow** | 7 | Canvas, Connection, Controls, Edge, Node, Panel, Toolbar |
| **Utilities** | 2 | Image, Open In Chat |

### 优先级分级原则

- **P0 核心对话**：构成最简可用聊天界面的必需组件，缺一不可
- **P1 增强体验**：显著提升用户体验，建议第二阶段实现
- **P2 高级功能**：特定场景才需要，按需实现
- **Domain**：垂直领域组件（Code/Voice/Workflow），独立包

### ai-chat-ui 组件优先级映射

| AI Elements 组件 | ai-chat-ui 对应 | 优先级 | 状态 |
|------------------|-----------------|--------|------|
| **Conversation** | `Conversation` 系列 | **P0** | 需升级（当前 ChatWindow + MessageList） |
| **Message** | `Message` 系列 | **P0** | 需升级（当前 MessageBubble） |
| **Prompt Input** | `PromptInput` 系列 | **P0** | 需升级（当前 InputArea） |
| **Attachments** | `Attachment` 系列 | **P0** | 新增 |
| **Tool** | `ToolCall` 系列 | **P0** | 新增 |
| **Shimmer** | `Shimmer` | **P0** | 新增（加载态） |
| Suggestion | `Suggestion` 系列 | P1 | 新增 |
| Sources | `Source` 系列 | P1 | 新增 |
| Reasoning | `Reasoning` 系列 | P1 | 新增 |
| Model Selector | `ModelSelector` | P1 | 新增 |
| Chain of Thought | `ChainOfThought` | P2 | 新增 |
| Checkpoint | - | P2 | 暂缓 |
| Confirmation | - | P2 | 暂缓 |
| Context | - | P2 | 暂缓 |
| Plan | - | P2 | 暂缓 |
| Queue | - | P2 | 暂缓 |
| Inline Citation | - | P2 | 暂缓 |
| Task | - | P2 | 暂缓 |
| Code 类 | `@ai-chat/code` | Domain | 独立包 |
| Voice 类 | `@ai-chat/voice` | Domain | 独立包 |
| Workflow 类 | `@ai-chat/workflow` | Domain | 独立包 |

---

## 二、P0 级组件详细设计

### 2.1 Conversation 系列（对话容器）

**对标**：AI Elements `Conversation`

**设计理念**：将现有 `ChatWindow` + `MessageList` 升级为可组合的对话容器系统，支持自动滚动、空状态、回到底部。

#### 组件拆分

```
Conversation.vue         — 对话根容器（管理滚动上下文）
├── ConversationContent.vue   — 消息滚动区域（自动吸底）
├── ConversationEmpty.vue     — 空对话占位（icon + title + description）
└── ConversationScrollBtn.vue — 滚动到底部按钮（非底部时显示）
```

#### Props 设计

```typescript
// Conversation.vue
interface ConversationProps {
  autoScroll?: boolean          // 新消息自动滚动到底部，默认 true
}

// ConversationContent.vue
interface ConversationContentProps {
  // 纯容器，无特殊 props
}

// ConversationEmpty.vue
interface ConversationEmptyProps {
  icon?: Component              // 空状态图标
  title?: string                // 标题，默认 "开始对话"
  description?: string          // 描述文字
}

// ConversationScrollBtn.vue — 无 props，通过 inject 获取滚动状态
```

#### 核心实现

- 使用 `useScrollAnchor` composable 管理滚动吸底逻辑
- `ConversationContent` 检测滚动位置，超出视口时 `ConversationScrollBtn` 自动显示
- `ConversationEmpty` 读取 inject 的 messages 长度，为空时显示

#### 与现有组件的关系

- **替代** `ChatWindow.vue`（布局容器职责）和 `MessageList.vue`（消息列表 + 滚动职责）
- 保留 `ChatWindow` 作为向后兼容的外层壳，内部使用 `Conversation` 系列

---

### 2.2 Message 系列（消息渲染）

**对标**：AI Elements `Message`

**设计理念**：将 `MessageBubble` 升级为完整的消息组件套件，支持内容渲染、操作按钮、附件显示、分支切换。

#### 组件拆分

```
Message.vue              — 消息根容器（区分 user/assistant 样式）
├── MessageContent.vue        — 内容区域（文本 + markdown + tool calls）
├── MessageActions.vue        — 操作栏容器
│   └── MessageAction.vue         — 单个操作按钮（copy/retry/like 等）
└── MessageAttachments.vue    — 消息内附件显示（引用 Attachment 系列）
```

#### Props 设计

```typescript
// Message.vue
interface MessageProps {
  from: 'user' | 'assistant' | 'system'  // 消息角色，决定样式对齐
}

// MessageContent.vue — 纯容器

// MessageActions.vue — 纯容器，flex 布局

// MessageAction.vue
interface MessageActionProps {
  label: string                 // 按钮文字
  icon?: Component              // 图标组件
  tooltip?: string              // hover 提示
  disabled?: boolean
}

// MessageAction Emits
interface MessageActionEmits {
  (e: 'click'): void
}

// MessageAttachments.vue
interface MessageAttachmentsProps {
  // 纯容器，遍历子 Attachment 组件
}
```

#### 核心实现

- `Message.vue` 根据 `from` prop 切换 CSS class：`ai-chat-message--user` / `ai-chat-message--assistant`
- 用户消息右对齐 + 二次色背景，助手消息左对齐 + 全宽
- `MessageActions` 仅在 hover 或 focus 时显示（`visibility: hidden/visible`，避免布局跳动）
- 内置 action：`copy`（复制到剪贴板）、`retry`（emit regenerate 事件）、`like`/`dislike`（emit reaction 事件）

#### 与现有组件的关系

- **升级** `MessageBubble.vue`，保持向后兼容
- 新增 `MessageActions`、`MessageAction`、`MessageAttachments` 子组件

---

### 2.3 PromptInput 系列（输入区域）

**对标**：AI Elements `Prompt Input`

**设计理念**：将 `InputArea` 升级为可组合的富输入系统，支持自适应高度、文件上传、工具栏、多标签。

#### 组件拆分

```
PromptInput.vue          — 输入表单容器
├── PromptInputBody.vue       — 主体区域（textarea + 附件预览）
│   └── PromptInputTextarea.vue   — 自适应高度输入框
├── PromptInputFooter.vue     — 底部工具栏区域
│   ├── PromptInputTools.vue       — 工具按钮组容器
│   │   └── PromptInputButton.vue      — 工具按钮（带 tooltip）
│   └── PromptInputSubmit.vue      — 发送/中断按钮（状态驱动图标切换）
└── PromptInputHeader.vue     — 顶部附件预览区
```

#### Props 设计

```typescript
// PromptInput.vue
interface PromptInputProps {
  disabled?: boolean            // 整体禁用
  placeholder?: string          // 默认 "输入消息..."
  maxHeight?: number            // textarea 最大高度，默认 200px
  accept?: string               // 文件类型限制
  multiple?: boolean            // 多文件上传
  maxFiles?: number             // 最大文件数
}

interface PromptInputEmits {
  (e: 'send', payload: { text: string; files?: File[] }): void
  (e: 'abort'): void
}

// PromptInputTextarea.vue
interface PromptInputTextareaProps {
  modelValue: string
  placeholder?: string
  maxHeight?: number
  disabled?: boolean
}

interface PromptInputTextareaEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void              // Enter 键
}

// PromptInputSubmit.vue
interface PromptInputSubmitProps {
  status: 'ready' | 'streaming'    // streaming 时显示停止按钮
  disabled?: boolean
}

// PromptInputButton.vue
interface PromptInputButtonProps {
  tooltip?: string              // hover 提示
  active?: boolean              // 激活态（如 web search 开启）
  disabled?: boolean
}
```

#### 核心实现

- `PromptInputTextarea`：监听 `input` 事件自动调整 `style.height`，上限 `maxHeight`
- Enter 发送、Shift+Enter 换行
- `PromptInputSubmit` 根据 `status` 切换图标：`ready` → 发送箭头 / `streaming` → 停止方块
- `PromptInputTools` 为 flex 容器，slot 放置自定义工具按钮
- 文件选择使用隐藏 `<input type="file">`，选择后 `PromptInputHeader` 显示附件预览

#### 与现有组件的关系

- **升级** `InputArea.vue`，API 不兼容但更强大
- 保留 `InputArea` 作为简化版本向后兼容

---

### 2.4 Attachment 系列（附件系统）

**对标**：AI Elements `Attachments`

**设计理念**：统一的附件显示系统，支持三种布局变体，覆盖消息内展示和输入区预览两个场景。

#### 组件拆分

```
Attachments.vue          — 附件容器（设置布局变体）
├── Attachment.vue            — 单个附件包装器
│   ├── AttachmentPreview.vue     — 预览（图片缩略图 / 文件图标）
│   ├── AttachmentInfo.vue        — 文件名 + 类型标签
│   └── AttachmentRemove.vue      — 删除按钮（hover 显示）
└── AttachmentEmpty.vue       — 无附件空状态
```

#### Props 设计

```typescript
// Attachments.vue
interface AttachmentsProps {
  variant?: 'grid' | 'inline' | 'list'  // 默认 'grid'
  // grid: 缩略图网格（消息内）
  // inline: 紧凑标签（输入区）
  // list: 完整行（文件列表）
}

// Attachment.vue
interface AttachmentProps {
  data: {
    id: string
    url?: string
    name: string
    mediaType: string          // MIME type
    size?: number              // 字节
  }
}

interface AttachmentEmits {
  (e: 'remove'): void
}

// AttachmentPreview.vue — 无 props，从 parent Attachment inject data
// AttachmentInfo.vue — 无 props，从 parent Attachment inject data
// AttachmentRemove.vue — 无 props，emit remove 到祖先
```

#### 核心实现

- `getMediaCategory(data)` 工具函数：根据 `mediaType` 返回 `'image' | 'video' | 'audio' | 'document'`
- **Grid 变体**：CSS Grid，图片 96x96 圆角缩略图，非图片显示文件图标 + 文件名
- **Inline 变体**：紧凑 badge 样式，hover 弹出预览
- **List 变体**：行布局，显示图标 + 文件名 + 大小 + 删除按钮
- `AttachmentRemove` 使用 `visibility: hidden/visible` hover 显示，不占布局

#### 扩展 Message 类型

```typescript
// core 包 Message 类型需扩展
interface Attachment {
  id: string
  url?: string
  name: string
  mediaType: string            // image/png, application/pdf 等
  size?: number
}

interface Message {
  // ...现有字段
  attachments?: Attachment[]
}
```

---

### 2.5 ToolCall 系列（工具调用面板）

**对标**：AI Elements `Tool`

**设计理念**：可折叠的工具调用可视化，显示工具名称、状态、输入参数和输出结果。

#### 组件拆分

```
ToolCall.vue              — 可折叠容器
├── ToolCallHeader.vue         — 头部（状态图标 + 工具名 + 耗时）
└── ToolCallContent.vue        — 展开内容
    ├── ToolCallInput.vue           — 输入参数（JSON 格式化）
    └── ToolCallOutput.vue          — 输出结果 / 错误信息
```

#### Props 设计

```typescript
// ToolCall.vue
interface ToolCallProps {
  toolCall: {
    id: string
    name: string                   // 工具名称
    arguments: Record<string, unknown>  // 输入参数
    result?: unknown               // 输出结果
    error?: string                 // 错误信息
    status: 'calling' | 'completed' | 'error'
    duration?: number              // 执行耗时 ms
  }
  defaultOpen?: boolean            // 默认展开，默认 false（completed 时 true）
}

// ToolCallHeader.vue — 从 parent inject toolCall
// ToolCallContent.vue — 从 parent inject toolCall
// ToolCallInput.vue — 从 parent inject toolCall，显示 arguments
// ToolCallOutput.vue — 从 parent inject toolCall，显示 result 或 error
```

#### 核心实现

- 使用 `<details>/<summary>` 或自定义折叠动画实现展开/收起
- 状态图标：`calling` → 黄色旋转加载 / `completed` → 绿色勾 / `error` → 红色叉
- `ToolCallInput` 格式化显示 JSON 参数（语法高亮可选，MVP 阶段用 `<pre>` + 等宽字体）
- `ToolCallOutput` 区分成功（格式化 JSON / 文本）和错误（红色错误文本）
- `completed` 状态默认展开显示结果，其他状态默认收起

#### 扩展 StreamChunk 类型

```typescript
// core 包 StreamChunk 类型需扩展
interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: {
    toolCallId?: string
    toolName?: string
    toolArguments?: Record<string, unknown>
    toolResult?: unknown
    toolError?: string
    duration?: number
  }
}

// Message 类型扩展
interface Message {
  // ...现有字段
  toolCalls?: ToolCallInfo[]
}

interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  status: 'calling' | 'completed' | 'error'
  duration?: number
}
```

---

### 2.6 Shimmer（加载微光动画）

**对标**：AI Elements `Shimmer`

**设计理念**：纯 CSS 实现的文本微光动画，用于 AI 响应等待态的视觉反馈。

#### 组件设计

```typescript
// Shimmer.vue
interface ShimmerProps {
  as?: string                   // 渲染为的 HTML 标签，默认 'span'
  duration?: number             // 动画时长 ms，默认 2000
}
```

#### 核心实现

- 使用 CSS `background: linear-gradient()` + `animation` 实现微光扫过效果
- `background-clip: text` + `color: transparent` 让文字本身产生微光
- 不依赖 Framer Motion，纯 CSS 实现（AI Elements 用 Framer Motion，我们保持零依赖原则）
- 用于 `ConversationEmpty` 加载态、`MessageResponse` 等待态

#### CSS 实现

```css
.ai-chat-shimmer {
  background: linear-gradient(
    90deg,
    var(--ai-chat-color-text-secondary) 0%,
    var(--ai-chat-color-text-primary) 50%,
    var(--ai-chat-color-text-secondary) 100%
  );
  background-size: 200% 100%;
  animation: ai-chat-shimmer 2s linear infinite;
  background-clip: text;
  color: transparent;
}

@keyframes ai-chat-shimmer {
  from { background-position: 200% center; }
  to { background-position: -200% center; }
}
```

---

## 三、升级后的目录结构

```
packages/
├── core/                          # @ai-chat/core
│   └── src/
│       ├── types/
│       │   └── index.ts               # Message, StreamChunk, ChatAdapter, ToolCallInfo, Attachment
│       ├── composables/
│       │   └── index.ts               # useChat（支持 tool_call/tool_result 消费）
│       ├── utils/
│       │   └── index.ts               # generateId, createUserMessage, createAssistantMessage
│       └── adapter/
│           └── index.ts
│
├── vue/                           # @ai-chat/vue
│   └── src/
│       ├── conversation/              # 对话容器系列
│       │   ├── Conversation.vue
│       │   ├── ConversationContent.vue
│       │   ├── ConversationEmpty.vue
│       │   ├── ConversationScrollBtn.vue
│       │   └── index.ts
│       ├── message/                   # 消息系列
│       │   ├── Message.vue
│       │   ├── MessageContent.vue
│       │   ├── MessageActions.vue
│       │   ├── MessageAction.vue
│       │   ├── MessageAttachments.vue
│       │   └── index.ts
│       ├── prompt-input/              # 输入系列
│       │   ├── PromptInput.vue
│       │   ├── PromptInputBody.vue
│       │   ├── PromptInputTextarea.vue
│       │   ├── PromptInputFooter.vue
│       │   ├── PromptInputTools.vue
│       │   ├── PromptInputButton.vue
│       │   ├── PromptInputSubmit.vue
│       │   ├── PromptInputHeader.vue
│       │   └── index.ts
│       ├── attachment/                # 附件系列
│       │   ├── Attachments.vue
│       │   ├── Attachment.vue
│       │   ├── AttachmentPreview.vue
│       │   ├── AttachmentInfo.vue
│       │   ├── AttachmentRemove.vue
│       │   └── index.ts
│       ├── tool-call/                 # 工具调用系列
│       │   ├── ToolCall.vue
│       │   ├── ToolCallHeader.vue
│       │   ├── ToolCallContent.vue
│       │   ├── ToolCallInput.vue
│       │   ├── ToolCallOutput.vue
│       │   └── index.ts
│       ├── shared/                    # 共享基础组件
│       │   ├── StreamText.vue
│       │   ├── Shimmer.vue
│       │   └── Button.vue
│       ├── composables/               # Vue composables
│       │   └── useScrollAnchor.ts
│       ├── utils/                     # 工具函数
│       │   ├── media.ts                  # getMediaCategory, getAttachmentLabel
│       │   └── format.ts                 # formatFileSize, formatDuration
│       └── index.ts                   # 统一导出
│
├── markdown/                      # @ai-chat/markdown（不变）
│   └── src/
│       ├── MarkdownRenderer.vue
│       ├── CodeBlock.vue
│       └── LatexBlock.vue
│
└── docs/                          # @ai-chat/docs（不变）
    └── ...
```

---

## 四、组件关系与组装方式

### P0 组件组装图

```
┌─────────────────────────────────────────────────┐
│ Conversation                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ ConversationContent                          │ │
│ │                                              │ │
│ │ ┌─ ConversationEmpty ──────────────────────┐│ │  ← 消息为空时
│ │ │  icon + title + description               ││ │
│ │ └──────────────────────────────────────────┘│ │
│ │                                              │ │
│ │ ┌─ Message from="user" ────────────────────┐│ │  ← 用户消息
│ │ │  MessageContent                           ││ │
│ │ │    MarkdownRenderer                       ││ │
│ │ │  MessageAttachments                       ││ │
│ │ │    Attachment (grid)                      ││ │
│ │ └──────────────────────────────────────────┘│ │
│ │                                              │ │
│ │ ┌─ Message from="assistant" ───────────────┐│ │  ← 助手消息
│ │ │  MessageContent                           ││ │
│ │ │    ToolCall (可折叠)                       ││ │
│ │ │    MarkdownRenderer                       ││ │
│ │ │    StreamText (流式中)                     ││ │
│ │ │  MessageActions (hover 显示)              ││ │
│ │ │    MessageAction (copy)                   ││ │
│ │ │    MessageAction (retry)                  ││ │
│ │ └──────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ConversationScrollBtn                            │  ← 非底部时显示
├──────────────────────────────────────────────────┤
│ PromptInput                                      │
│ ┌─ PromptInputHeader ──────────────────────────┐│  ← 有附件时显示
│ │  Attachments (inline variant)                ││
│ └──────────────────────────────────────────────┘│
│ ┌─ PromptInputBody ────────────────────────────┐│
│ │  PromptInputTextarea (自适应高度)             ││
│ └──────────────────────────────────────────────┘│
│ ┌─ PromptInputFooter ──────────────────────────┐│
│ │  PromptInputTools                            ││
│ │    PromptInputButton (附加文件)               ││
│ │  PromptInputSubmit (发送/中断)               ││
│ └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 完整用法示例

```vue
<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import {
  Conversation, ConversationContent, ConversationEmpty, ConversationScrollBtn,
  Message, MessageContent, MessageActions, MessageAction,
  PromptInput, PromptInputTextarea, PromptInputSubmit,
  Attachments, Attachment, AttachmentPreview, AttachmentRemove,
  ToolCall,
} from '@ai-chat/vue'
import { MarkdownRenderer } from '@ai-chat/markdown'

const { messages, isStreaming, send, abort } = useChat(adapter)
</script>

<template>
  <Conversation>
    <ConversationContent>
      <ConversationEmpty v-if="messages.length === 0" />

      <template v-for="msg in messages" :key="msg.id">
        <Message :from="msg.role">
          <MessageContent>
            <!-- 工具调用 -->
            <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :tool-call="tc" />

            <!-- Markdown 渲染 -->
            <MarkdownRenderer :content="msg.content" />
          </MessageContent>

          <!-- 附件 -->
          <Attachments v-if="msg.attachments?.length" variant="grid">
            <Attachment v-for="att in msg.attachments" :key="att.id" :data="att">
              <AttachmentPreview />
              <AttachmentRemove />
            </Attachment>
          </Attachments>

          <!-- 操作按钮 -->
          <MessageActions v-if="msg.role === 'assistant'">
            <MessageAction label="复制" icon="copy" @click="copyMessage(msg)" />
            <MessageAction label="重试" icon="retry" @click="retry()" />
          </MessageActions>
        </Message>
      </template>
    </ConversationContent>
    <ConversationScrollBtn />
  </Conversation>

  <PromptInput
    :disabled="isStreaming"
    @send="send"
    @abort="abort"
  >
    <PromptInputTextarea placeholder="输入消息..." />
    <PromptInputSubmit :status="isStreaming ? 'streaming' : 'ready'" />
  </PromptInput>
</template>
```

---

## 五、P0 实现路线图

### Phase 1：基础容器升级（1-2 天）

| 任务 | 说明 |
|------|------|
| `useScrollAnchor` composable | 滚动吸底逻辑，检测是否在底部、滚动到底部 |
| `Conversation` 系列组件 | Conversation / Content / Empty / ScrollBtn |
| `Shimmer` 组件 | 纯 CSS 微光动画 |
| 升级 `Message.vue` | 拆分 from prop 样式、支持 inject 消息数据 |

### Phase 2：消息增强（1-2 天）

| 任务 | 说明 |
|------|------|
| `MessageActions` + `MessageAction` | 操作按钮栏，hover 显示 |
| `PromptInput` 系列组件 | 自适应 textarea + 状态驱动提交按钮 |
| 升级 `StreamText` | 集成 Shimmer 等待态 |

### Phase 3：多模态 + 工具调用（2-3 天）

| 任务 | 说明 |
|------|------|
| Core 类型扩展 | Message 增加 attachments/toolCalls，StreamChunk 增加 tool_call/tool_result |
| `useChat` 升级 | 消费 tool_call/tool_result chunk，维护 toolCalls 数组 |
| `Attachment` 系列组件 | 三种变体布局 + 媒体类型检测 |
| `ToolCall` 系列组件 | 可折叠面板 + 状态图标 + JSON 展示 |

### Phase 4：集成测试 + 文档更新（1 天）

| 任务 | 说明 |
|------|------|
| 组件集成测试 | 覆盖组装场景：消息发送 → 流式响应 → 工具调用 → 附件显示 |
| docs 更新 | 更新 Playground 和 API 文档 |
| README 更新 | 更新目录结构和组件列表 |

---

## 六、与 AI Elements 的关键差异

| 维度 | AI Elements (React) | ai-chat-ui (Vue) |
|------|--------------------|--------------------|
| UI 框架 | shadcn/ui + Tailwind | CSS Variables 零依赖 |
| 状态管理 | AI SDK `useChat` hook | 自研 `useChat` composable + ChatAdapter 接口 |
| 后端耦合 | 强绑定 `@ai-sdk/react` | 完全解耦，ChatAdapter 接口适配任意后端 |
| 组件风格 | Copy-paste (shadcn 模式) | npm 安装，按需引入 |
| Markdown | Streamdown 库 | 自研 MarkdownRenderer（Shiki + KaTeX） |
| 主题系统 | Tailwind CSS 变量 | 三层 Design Token（Primitive → Semantic → Component） |
| 文件结构 | 单文件组件，全部平铺 | 按功能目录分组，每个系列有 index.ts |
| 暗色模式 | Tailwind dark: 前缀 | 语义令牌重定义，组件零修改 |

---

## 七、向后兼容策略

升级过程中保持向后兼容：

1. **保留旧组件文件**：`ChatWindow.vue`、`MessageList.vue`、`MessageBubble.vue`、`InputArea.vue` 标记 `@deprecated`
2. **旧组件内部代理到新组件**：`MessageBubble.vue` 内部使用 `Message.vue` + `MessageContent.vue`
3. **导出兼容**：`@ai-chat/vue` 的 `index.ts` 同时导出新旧组件名
4. **主版本升级时移除**：v1.0.0 正式版移除 deprecated 组件
