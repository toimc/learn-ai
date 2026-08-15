# ai-chat-ui

后端无关的 AI 聊天界面组件库，基于 Vue 3 + TypeScript。

## 特性

- **Provider 抽象层**：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端
- **32 个可组合组件**：Conversation / Message / Comparison / PromptInput / Attachment / ToolCall / Shared 七大系列
- **Design Token 体系**：三层 CSS Variables（原始→语义→组件），暗色/亮色双主题
- **样式隔离**：全部库样式收在 `@layer` 级联层内，不污染宿主；宿主一行未分层 CSS 即可覆盖任意组件样式，无需 `!important`
- **ToolCall 可视化**：原生支持 AI 工具调用（function call）的参数、结果和状态展示
- **AsyncGenerator 流式渲染**：`sendMessage` 返回 `AsyncGenerator<StreamChunk>`，原生支持流式输出
- **零 CSS 框架依赖**：不绑定 Tailwind / UnoCSS 等框架
- **Monorepo 按需安装**：每个包独立发布，只装需要的
- **provide/inject 状态管理**：支持同一页面多个独立对话实例

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 | ^3.5 |
| 语言 | TypeScript | ^6.0 |
| 构建 | Vite | ^8.0 |
| 包管理 | pnpm workspace | ^9.0 |
| 测试 | Vitest + @vue/test-utils | ^4.1 / ^2.4 |
| 文档站 | VitePress | ^1.6 |

## 项目结构

```
ai-chat-ui/
├── packages/
│   ├── core/                  # @ai-chat/core — 核心类型与 composables（零外部依赖）
│   │   ├── src/types/         # Message, StreamChunk, ChatAdapter, ToolCallInfo
│   │   ├── src/composables/   # useChat（流式消费 + tool_call 处理）
│   │   └── src/utils/         # generateId, createUserMessage, createAssistantMessage
│   │
│   ├── vue/                   # @ai-chat/vue — 32 个 Vue 3 组件
│   │   └── src/
│   │       ├── styles/        # tokens.css + animations.css（Design Token 体系）
│   │       ├── conversation/  # Conversation / Content / Empty / ScrollBtn
│   │       ├── message/       # Message / Content / Actions / Action / Attachments
│   │       ├── prompt-input/  # PromptInput / Textarea / Submit / Footer / Tools / Button / Header
│   │       ├── attachment/    # Attachments / Attachment / Preview / Info / Remove / Empty
│   │       ├── tool-call/     # ToolCall / Header / Content / Input / Output
│   │       ├── shared/        # StreamText / Button / Shimmer
│   │       ├── composables/   # useScrollAnchor
│   │       └── utils/         # media.ts + format.ts
│   │
│   ├── markdown/              # @ai-chat/markdown — Markdown 渲染
│   │   └── src/               # MarkdownRenderer / CodeBlock / LatexBlock
│   │
│   └── docs/                  # @ai-chat/docs — VitePress 文档站
│       └── .vitepress/
│           ├── components/    # PlaygroundDemo（完整 Playground）
│           ├── theme/         # 全局组件注册
│           └── utils/         # mock-adapter（支持 tool_call）
```

## 快速开始

### 安装

```bash
pnpm add @ai-chat/core @ai-chat/vue @ai-chat/markdown
```

### 基本用法

```vue
<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import {
  Conversation, ConversationContent, ConversationEmpty,
  Message, MessageContent, MessageActions, MessageAction,
  PromptInput, PromptInputTextarea, PromptInputSubmit,
  PromptInputFooter, PromptInputTools,
} from '@ai-chat/vue'
import type { ChatAdapter } from '@ai-chat/core'

const adapter: ChatAdapter = {
  async *sendMessage({ messages, signal }) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield { type: 'text', content: decoder.decode(value, { stream: true }) }
    }
    yield { type: 'done', content: '' }
  },
}

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

    <PromptInput>
      <PromptInputTextarea @send="(t) => chat.send(t)" />
      <PromptInputSubmit />
    </PromptInput>
  </Conversation>
</template>
```

## 组件一览

### Conversation 系列（对话容器）

| 组件 | 说明 |
|------|------|
| Conversation | 根容器，provide 滚动上下文 |
| ConversationContent | 可滚动消息区，max-width 768px |
| ConversationEmpty | 欢迎屏空状态 |
| ConversationScrollBtn | 回到底部浮动按钮 |

### Message 系列（消息渲染）

| 组件 | 说明 |
|------|------|
| Message | 消息项，avatar + body 布局 |
| MessageContent | 消息正文容器 |
| MessageActions | 操作按钮容器（hover 显示） |
| MessageAction | 单个操作按钮（30px 方形） |
| MessageAttachments | 附件容器 |

### PromptInput 系列（输入系统）

| 组件 | 说明 |
|------|------|
| PromptInput | 外层容器，provide 输入上下文 |
| PromptInputTextarea | 自适应输入框（Enter 发送 / Shift+Enter 换行） |
| PromptInputSubmit | 发送/停止切换按钮 |
| PromptInputBody | 输入行容器 |
| PromptInputFooter | 底部工具栏 |
| PromptInputTools | 工具按钮组 |
| PromptInputButton | 单个工具按钮 |
| PromptInputHeader | 附件预览区域 |

### Comparison 系列（偏好对比）

| 组件 | 说明 |
|------|------|
| ComparisonMessage | A/B 双列对比，左右各一「我更喜欢这个回复」按钮，收集用户偏好 |

### Attachment 系列（附件展示）

| 组件 | 说明 |
|------|------|
| Attachments | 容器（grid / inline / list 布局） |
| Attachment | 单附件，provide 数据 |
| AttachmentPreview | 图片缩略图 / 文件图标 |
| AttachmentInfo | 文件名 + 类型 + 大小 |
| AttachmentRemove | hover 删除按钮 |
| AttachmentEmpty | 空状态 |

### ToolCall 系列（工具调用）

| 组件 | 说明 |
|------|------|
| ToolCall | 可折叠容器（details/summary） |
| ToolCallHeader | 状态图标 + 工具名 + 耗时 |
| ToolCallContent | 展开内容 |
| ToolCallInput | 格式化参数 JSON |
| ToolCallOutput | 结果或错误 |

### Shared（通用组件）

| 组件 | 说明 |
|------|------|
| StreamText | 流式文本（光标动画） |
| Button | 通用按钮 |
| Shimmer | 微光扫过动画 |

## 核心 API

### @ai-chat/core

| 导出 | 类型 | 说明 |
|------|------|------|
| `useChat(adapter, options?)` | Composable | 返回 ChatState（messages / isStreaming / send / abort / clear） |
| `generateId()` | 函数 | 生成唯一 ID |
| `createUserMessage(content, attachments?)` | 函数 | 创建用户消息 |
| `createAssistantMessage()` | 函数 | 创建助手消息 |

### 核心类型

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  toolCalls?: ToolCallInfo[]
  metadata?: Record<string, unknown>
  createdAt: Date
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

interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: Record<string, unknown>
}

interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
}
```

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动文档站
pnpm build          # 构建所有包
pnpm test           # 运行测试
pnpm lint           # 代码检查
pnpm type-check     # 类型检查
pnpm clean          # 清理构建产物
```

## 开发工作流

本项目采用 Git Flow + Worktree 工作流，完整规则见 [`.claude/rules/git-flow-worktree.md`](.claude/rules/git-flow-worktree.md)。

| 分支 | 职责 |
|------|------|
| `master` | 生产分支，只接收合并与发版，不写业务代码 |
| `dev` | 集成分支，所有 feature 的合并目标 |
| `feat/*` | 新功能，从 `dev` 开 |
| `fix/*` | 生产紧急修复，从 `master` 开 |

- 所有功能开发在 worktree 内隔离进行，主目录只做合并 / 发版
- feature 从 `dev` 开、合 `dev`；`dev` 领先 `master` 时在 `master` 上集中发版
- 生产部署通过 `.claude/run/deploy.lock` 文件锁互斥，避免并发

## 包状态

| 包 | 版本 | 状态 |
|------|------|------|
| @ai-chat/core | 0.0.1 | ChatAdapter + useChat + ToolCallInfo |
| @ai-chat/vue | 0.0.1 | 32 个 Vue 3 组件 + Design Token |
| @ai-chat/markdown | 0.0.1 | Markdown + Shiki + KaTeX（公式样式经 `@ai-chat/markdown/katex.css` 可选引入） |
| @ai-chat/docs | 私有 | VitePress 文档站 + Playground |

## License

MIT
