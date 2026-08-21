# ai-chat-ui

后端无关的 AI 聊天界面组件库，基于 Vue 3 + TypeScript。

## 特性

- **Provider 抽象层**：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端
- **33 个可组合组件**：Conversation / Message / Comparison / PromptInput / Attachment / ToolCall / Shared 七大系列
- **Design Token 体系**：三层 CSS Variables（原始→语义→组件），暗色/亮色双主题
- **样式隔离**：全部库样式收在 `@layer` 级联层内，不污染宿主；宿主一行未分层 CSS 即可覆盖任意组件样式，无需 `!important`
- **ToolCall 可视化**：原生支持 AI 工具调用（function call）的参数、结果和状态展示
- **思考过程展示**：`thinking` chunk 流式呈现推理内容，done 时自动计算耗时并折叠为一行触发器（内置 ThinkingBlock，经 `MessageContent` 的 `thinking` prop 驱动）
- **A/B 回复对比**：`Message.comparison` 载荷驱动 ComparisonMessage 双列对比，用户点选后选中内容原地固化为普通消息
- **AsyncGenerator 流式渲染**：`sendMessage` 返回 `AsyncGenerator<StreamChunk>`，原生支持流式输出
- **零 CSS 框架依赖**：不绑定 Tailwind / UnoCSS 等框架
- **Monorepo 按需安装**：每个包独立发布，只装需要的
- **服务端网关**：`@toimc/server` 基于 Hono 的接收与转发层（Bearer 认证 / 限流 / CORS 可选启用），`@toimc/agents` 多模型协议适配（OpenAI 兼容 / Anthropic / 自定义），API Key 只留服务端
- **Mastra Agent 接入**：`@toimc/agents/mastra` 可选子路径把 Mastra Agent 包装成标准适配器（工具调用 / 会话记忆 / 配合 Mastra Studio 监控），`@mastra/core` 为可选依赖
- **provide/inject 状态管理**：支持同一页面多个独立对话实例

## 技术栈

| 类别     | 技术                     | 版本        |
| -------- | ------------------------ | ----------- |
| 框架     | Vue 3                    | ^3.5        |
| 语言     | TypeScript               | ^6.0        |
| 构建     | Vite                     | ^8.0        |
| 包管理   | pnpm workspace           | ^9.0        |
| 单元测试 | Vitest + @vue/test-utils | ^4.1 / ^2.4 |
| E2E测试  | Playwright               | ^1.62       |
| 文档站   | VitePress                | ^1.6        |

## 项目结构

```
ai-chat-ui/
├── packages/
│   ├── core/                  # @toimc/core — 核心类型与 composables（零外部依赖）
│   │   ├── src/types/         # Message, StreamChunk, ChatAdapter, ToolCallInfo
│   │   ├── src/composables/   # useChat（流式消费 + tool_call 处理）
│   │   └── src/utils/         # generateId, createUserMessage, createAssistantMessage
│   │
│   ├── vue/                   # @toimc/vue — 33 个 Vue 3 组件
│   │   └── src/
│   │       ├── styles/        # tokens.css + animations.css（Design Token 体系）
│   │       ├── conversation/  # Conversation / Content / Empty / ScrollBtn
│   │       ├── message/       # Message / Content / Actions / Action / Attachments
│   │       ├── prompt-input/  # PromptInput / Textarea / Submit / Footer / Tools / Button / Header
│   │       ├── attachment/    # Attachments / Attachment / Preview / Info / Remove / Empty
│   │       ├── tool-call/     # ToolCall / Header / Content / Input / Output
│   │       ├── shared/        # StreamText / Button / Shimmer / Toast
│   │       ├── composables/   # useScrollAnchor
│   │       └── utils/         # media.ts + format.ts
│   │
│   ├── markdown/              # @toimc/markdown — Markdown 渲染
│   │   └── src/               # MarkdownRenderer / CodeBlock / LatexBlock
│   │
│   ├── agents/                # @toimc/agents — 服务端模型适配层（零外部依赖）
│   │   └── src/               # IModelAdapter / ModelRegistry / OpenAI 兼容与 Anthropic 适配器 / SSE 解析 / mastra 可选子路径（Mastra Agent 包装）
│   │
│   ├── server/                # @toimc/server — Hono 聊天网关（接收与转发）
│   │   └── src/               # createChatGateway / chat·models·health 路由 / auth·rateLimit 中间件
│   │
│   ├── mock-server/           # @toimc/mock-server — 本地 mock 服务端（私有，基于 @toimc/server 组装）
│   │   └── src/               # 会话种子数据 / mock 剧本适配器 / Mastra Agent（env 门控，经 @toimc/agents/mastra 注册）/ 演示路由 + OpenAPI 规范，pnpm dev 随文档站一起启动
│   │
│   └── docs/                  # @toimc/docs — VitePress 文档站
│       └── .vitepress/
│           ├── components/    # PlaygroundDemo（完整 Playground）
│           ├── theme/         # 全局组件注册
│           └── utils/         # mock-adapter（支持 tool_call）
```

## 快速开始

### 安装

```bash
pnpm add @toimc/core @toimc/vue @toimc/markdown
```

### 基本用法

```vue
<script setup lang="ts">
import { useChat } from '@toimc/core'
import {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputTools,
} from '@toimc/vue'
import type { ChatAdapter } from '@toimc/core'

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

| 组件                  | 说明                          |
| --------------------- | ----------------------------- |
| Conversation          | 根容器，provide 滚动上下文    |
| ConversationContent   | 可滚动消息区，max-width 768px |
| ConversationEmpty     | 欢迎屏空状态                  |
| ConversationScrollBtn | 回到底部浮动按钮              |

### Message 系列（消息渲染）

| 组件               | 说明                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Message            | 消息项，avatar + body 布局                                                                        |
| MessageContent     | 消息正文容器（`content` 走 Markdown 渲染；`thinking` 显示折叠式思考块；`streaming` 驱动流式状态） |
| MessageActions     | 操作按钮容器（hover 显示）                                                                        |
| MessageAction      | 单个操作按钮（30px 方形）                                                                         |
| MessageAttachments | 附件容器                                                                                          |

### PromptInput 系列（输入系统）

| 组件                | 说明                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| PromptInput         | 外层容器，provide 输入上下文，承载多模态附件管道（上传/粘贴/拖拽）    |
| PromptInputTextarea | 自适应输入框（`sendKey` 切换 Enter / Alt+Enter 发送，IME 组合期防御） |
| PromptInputSubmit   | 发送/停止切换按钮                                                     |
| PromptInputBody     | 输入行容器                                                            |
| PromptInputFooter   | 底部工具栏                                                            |
| PromptInputTools    | 工具按钮组                                                            |
| PromptInputButton   | 单个工具按钮                                                          |
| PromptInputHeader   | 附件预览区域                                                          |

### Comparison 系列（偏好对比）

| 组件              | 说明                                                         |
| ----------------- | ------------------------------------------------------------ |
| ComparisonMessage | A/B 双列对比，左右各一「我更喜欢这个回复」按钮，收集用户偏好 |

### Attachment 系列（附件展示）

| 组件              | 说明                                             |
| ----------------- | ------------------------------------------------ |
| Attachments       | 容器（grid / inline / list 布局）                |
| Attachment        | 单附件，provide 数据                             |
| AttachmentPreview | 图片缩略图 / 文件图标                            |
| AttachmentInfo    | 文件名 + 类型 + 大小                             |
| AttachmentRemove  | hover 删除按钮                                   |
| AttachmentEmpty   | 空状态                                           |
| ImageLightbox     | 图片灯箱预览（Esc 关闭、方向键翻页，可独立使用） |

### ToolCall 系列（工具调用）

| 组件            | 说明                          |
| --------------- | ----------------------------- |
| ToolCall        | 可折叠容器（details/summary） |
| ToolCallHeader  | 状态图标 + 工具名 + 耗时      |
| ToolCallContent | 展开内容                      |
| ToolCallInput   | 格式化参数 JSON               |
| ToolCallOutput  | 结果或错误                    |

### Shared（通用组件）

| 组件       | 说明                   |
| ---------- | ---------------------- |
| StreamText | 流式文本（光标动画）   |
| Button     | 通用按钮               |
| Shimmer    | 微光扫过动画           |
| Toast      | 顶部轻提示（自动关闭） |

## 核心 API

### @toimc/core

| 导出                                       | 类型       | 说明                                                            |
| ------------------------------------------ | ---------- | --------------------------------------------------------------- |
| `useChat(adapter, options?)`               | Composable | 返回 ChatState（messages / isStreaming / send / abort / clear） |
| `generateId()`                             | 函数       | 生成唯一 ID                                                     |
| `createUserMessage(content, attachments?)` | 函数       | 创建用户消息                                                    |
| `createAssistantMessage()`                 | 函数       | 创建助手消息                                                    |

### 核心类型

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  toolCalls?: ToolCallInfo[]
  thinking?: ThinkingInfo // 思考过程（thinking chunk 自动累积，done 时补耗时）
  comparison?: ComparisonPayload // A/B 回复对比载荷
  metadata?: Record<string, unknown>
  createdAt: Date
}

interface ThinkingInfo {
  content: string
  duration?: number // 思考耗时（毫秒），useChat 在 done 时自动计算
  startTime?: Date
}

interface ComparisonPayload {
  left: string
  right: string
  leftLabel?: string
  rightLabel?: string
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
pnpm test           # 运行单元测试
pnpm test:e2e       # 运行端到端测试
pnpm test:e2e:ui    # E2E测试UI模式
pnpm lint           # 代码检查
pnpm type-check     # 类型检查
pnpm clean          # 清理构建产物
```

### 端到端测试

项目使用 Playwright 进行端到端测试，覆盖 Playground 的核心功能：

- **基础功能**: 消息发送、会话切换、流式渲染、UI交互
- **高级功能**: Markdown渲染、代码高亮、主题切换、国际化支持
- **多浏览器**: Chromium、Firefox、WebKit、移动端

```bash
# 首次使用安装浏览器
pnpm exec playwright install --with-deps

# 运行E2E测试
pnpm test:e2e          # 后台运行所有测试
pnpm test:e2e:ui       # UI模式运行（推荐）
pnpm test:e2e:debug    # 调试模式
pnpm test:e2e:headed   # 有头模式（显示浏览器）
pnpm test:e2e:report   # 查看HTML报告
```

详细文档见 [E2E测试README](./e2e/README.md) 和 [快速开始指南](./E2E-QUICKSTART.md)。

## 开发工作流

本项目采用 Git Flow + Worktree 工作流，完整规则见 [`.claude/rules/git-flow-worktree.md`](.claude/rules/git-flow-worktree.md)。

| 分支     | 职责                                     |
| -------- | ---------------------------------------- |
| `master` | 生产分支，只接收合并与发版，不写业务代码 |
| `dev`    | 集成分支，所有 feature 的合并目标        |
| `feat/*` | 新功能，从 `dev` 开                      |
| `fix/*`  | 生产紧急修复，从 `master` 开             |

- 所有功能开发在 worktree 内隔离进行，主目录只做合并 / 发版
- feature 从 `dev` 开、合 `dev`；`dev` 领先 `master` 时在 `master` 上集中发版
- 生产部署通过 `.claude/run/deploy.lock` 文件锁互斥，避免并发

## 包状态

| 包              | 版本  | 状态                                                                        |
| --------------- | ----- | --------------------------------------------------------------------------- |
| @toimc/core     | 0.0.1 | ChatAdapter + useChat + ToolCallInfo                                        |
| @toimc/vue      | 0.0.1 | 33 个 Vue 3 组件 + Design Token                                             |
| @toimc/markdown | 0.0.1 | Markdown + Shiki + KaTeX（公式样式经 `@toimc/markdown/katex.css` 可选引入） |
| @toimc/docs     | 私有  | VitePress 文档站 + Playground                                               |

## License

MIT
