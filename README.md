# ai-chat-ui

后端无关的 AI 聊天界面组件库，基于 Vue 3 + TypeScript。

## 已完成功能

- **Core 核心层**：`ChatAdapter` 接口 + `useChat` composable + 流式处理 + 消息工厂函数
- **Vue 组件层**：ChatWindow / MessageList / MessageBubble / InputArea / StreamText / Button 共 6 个组件
- **Markdown 渲染层**：MarkdownRenderer / CodeBlock / LatexBlock 组件（Shiki 代码高亮 + KaTeX 公式）
- **文档站点**：VitePress 文档站，含组件文档、使用指南、Playground 交互演示
- **工程化配置**：ESLint + Prettier + Vitest + simple-git-hooks + commitlint + Conventional Commits
- **容器化部署**：多阶段构建 Dockerfile（Node 构建 → Nginx 部署）

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 | ^3.5 |
| 语言 | TypeScript | ^6.0 |
| 构建 | Vite | ^8.0 |
| 包管理 | pnpm workspace | ^9.0 |
| 测试 | Vitest + @vue/test-utils | ^4.1 / ^2.4 |
| 代码规范 | ESLint + Prettier | ^10.4 / ^3.8 |
| Git Hooks | simple-git-hooks + lint-staged + commitlint | - |
| 文档站 | VitePress | ^1.6 |
| 代码高亮 | Shiki | - |
| 数学公式 | KaTeX | - |
| 容器化 | Docker + Nginx | - |

### 技术特点

- **Provider 抽象层**：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端（OpenAI / Claude / 自建 API）
- **AsyncGenerator 流式渲染**：`sendMessage` 返回 `AsyncGenerator<StreamChunk>`，原生支持流式输出
- **零 CSS 框架依赖**：CSS Variables（`--ai-chat-*`）主题定制，不绑定 Tailwind / UnoCSS 等框架
- **Monorepo 按需安装**：每个包独立发布，只装需要的
- **provide/inject 状态管理**：组件级状态管理，支持同一页面多个独立对话实例
- **三格式导出**：ESM (`.mjs`) + CJS (`.cjs`) + 类型声明 (`.d.ts`)

## 项目结构

```
ai-chat-ui/
├── packages/
│   ├── core/                  # @ai-chat/core — 核心类型与 composables（零外部依赖）
│   │   ├── src/
│   │   │   ├── types/         # Message, StreamChunk, ChatAdapter 等核心接口
│   │   │   ├── composables/   # useChat composable（响应式状态 + 流式消费）
│   │   │   ├── utils/         # generateId, createUserMessage, createAssistantMessage
│   │   │   └── adapter/       # Adapter 相关工具
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── vue/                   # @ai-chat/vue — Vue 3 UI 组件（依赖 core，peer 依赖 vue）
│   │   ├── src/
│   │   │   ├── ChatWindow.vue     # 聊天窗口布局容器
│   │   │   ├── MessageList.vue    # 消息列表（作用域 slot）
│   │   │   ├── MessageBubble.vue  # 消息气泡（用户/助手样式区分）
│   │   │   ├── InputArea.vue      # 输入区域（发送/中断切换）
│   │   │   ├── StreamText.vue     # 流式文本（光标动画）
│   │   │   └── Button.vue         # 通用按钮组件
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── markdown/              # @ai-chat/markdown — Markdown 渲染（依赖 core + vue）
│   │   ├── src/
│   │   │   ├── MarkdownRenderer.vue  # Markdown 渲染器
│   │   │   ├── CodeBlock.vue         # 代码块（Shiki 高亮）
│   │   │   └── LatexBlock.vue        # 数学公式（KaTeX）
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── docs/                  # @ai-chat/docs — VitePress 文档站（私有包）
│       ├── .vitepress/
│       │   ├── config.ts          # VitePress 配置（导航 + 侧边栏）
│       │   ├── theme/             # 自定义主题
│       │   ├── components/        # DemoContainer 等文档组件
│       │   └── utils/             # mock-adapter 演示用适配器
│       ├── guide/                 # 使用指南文档
│       ├── components/            # 组件 API 文档
│       ├── composables/           # Composable 文档
│       ├── public/
│       │   └── playground.html    # 交互式 Playground
│       └── package.json
│
├── CLAUDE.md                  # AI 开发规范（编码约定 + Git 规范）
├── Dockerfile                 # 多阶段构建（Node 构建 → Nginx 部署）
├── vitest.config.ts           # Vitest 测试配置（jsdom 环境）
├── eslint.config.js           # ESLint Flat Config
├── commitlint.config.js       # Commit 信息规范（Conventional Commits，subject ≤59 字）
├── tsconfig.base.json         # TypeScript 基础配置
├── pnpm-workspace.yaml        # pnpm workspace 定义
└── package.json               # 根 package.json（脚本 + Git Hooks）
```

### 包依赖关系

```
@ai-chat/core (无外部依赖)
    ↑
@ai-chat/vue (依赖 core，peer 依赖 vue ^3.5)
    ↑
@ai-chat/markdown (依赖 core + vue，peer 依赖 vue ^3.5)

@ai-chat/docs (依赖 core + vue + markdown，私有包不发布)
```

### 后续目录规划

按照组件库工程化实践，后续将按需新增以下目录结构：

```
packages/
├── theme/                    # @ai-chat/theme — 主题预设包
│   └── src/
│       ├── tokens/           # Design Tokens（原始/语义/组件三层）
│       ├── presets/          # 内置主题预设（默认蓝/优雅紫/自然绿/暖橙）
│       └── dark/             # 暗色模式变量定义
│
├── agents/                   # @ai-chat/agents — 模型调用层（零外部依赖）
│   └── src/
│       ├── adapters/         # OpenAI / Anthropic / Google 模型适配器
│       └── registry/         # ModelRegistry 多模型注册
│
├── tools/                    # @ai-chat/tools — 工具集成层（零外部依赖）
│   └── src/
│       ├── definitions/      # 工具类型定义
│       └── executor/         # ToolExecutor + ToolRegistry
│
└── server/                   # @ai-chat/server — HTTP 服务层
    └── src/
        ├── routes/           # API 路由（POST /api/chat SSE）
        └── middleware/       # CORS / 认证 / 限流 / 日志
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
import { ChatWindow, MessageList, MessageBubble, InputArea } from '@ai-chat/vue'
import { MarkdownRenderer } from '@ai-chat/markdown'
import type { ChatAdapter, SendMessageOptions, StreamChunk } from '@ai-chat/core'

// 1. 实现 ChatAdapter 接口
const adapter: ChatAdapter = {
  async *sendMessage({ messages, signal }: SendMessageOptions): AsyncGenerator<StreamChunk> {
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

// 2. 使用 useChat composable
const { messages, isStreaming, send, abort } = useChat(adapter)
</script>

<template>
  <ChatWindow>
    <MessageList :messages="messages" v-slot="{ message }">
      <MessageBubble :message="message">
        <MarkdownRenderer :content="message.content" />
      </MessageBubble>
    </MessageList>
    <InputArea
      :disabled="isStreaming"
      @send="send"
      @abort="abort"
    />
  </ChatWindow>
</template>
```

## 核心 API

### @ai-chat/core

| 导出 | 类型 | 说明 |
|------|------|------|
| `useChat(adapter, options?)` | Composable | 返回响应式 `ChatState`（messages / isStreaming / error / send / abort / clear） |
| `generateId()` | 函数 | 生成 `msg_{timestamp}_{counter}` 格式唯一 ID |
| `createUserMessage(content, attachments?)` | 函数 | 创建用户消息对象 |
| `createAssistantMessage(content?, metadata?)` | 函数 | 创建助手消息对象 |

### 核心类型

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  createdAt: Date
}

interface StreamChunk {
  type: 'text' | 'tool_call' | 'thinking' | 'error' | 'done'
  content: string
  metadata?: Record<string, unknown>
}

interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
  abort?(requestId: string): void
  getHistory?(options: HistoryOptions): Promise<Message[]>
}
```

### @ai-chat/vue 组件

| 组件 | Props | 说明 |
|------|-------|------|
| `ChatWindow` | - | 聊天窗口布局容器 |
| `MessageList` | `messages: Message[]` | 消息列表，作用域 slot 暴露 `{ message }` |
| `MessageBubble` | `message: Message` | 消息气泡，区分用户/助手样式 |
| `InputArea` | `disabled: boolean` | 输入区域，emit `send` / `abort` 事件 |
| `StreamText` | - | 流式文本渲染，带光标动画 |
| `Button` | - | 通用按钮组件 |

### @ai-chat/markdown 组件

| 组件 | Props | 说明 |
|------|-------|------|
| `MarkdownRenderer` | `content: string` | Markdown 渲染器 |
| `CodeBlock` | - | 代码块，Shiki 语法高亮 |
| `LatexBlock` | - | LaTeX 数学公式，KaTeX 渲染 |

## 开发

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### 常用命令

```bash
# 安装依赖
pnpm install

# 启动文档站（VitePress，含组件演示和 Playground）
pnpm dev

# 构建所有库包（core → vue → markdown 按依赖顺序）
pnpm build

# 运行测试（Vitest，jsdom 环境）
pnpm test

# 监听模式测试
pnpm test:watch

# 代码检查
pnpm lint

# 自动修复代码问题
pnpm lint:fix

# 格式化代码
pnpm format

# 检查格式
pnpm format:check

# 类型检查（core + vue + markdown 三个包）
pnpm type-check

# 清理所有构建产物
pnpm clean
```

### Git Hooks

项目配置了 `simple-git-hooks`，提交时自动执行：

- **pre-commit**：lint-staged 运行 Prettier 格式化 + ESLint 修复
- **commit-msg**：commitlint 校验提交信息（Conventional Commits 格式，subject 不超过 59 字）

### 提交规范

```
type(scope): subject

feat(vue): 添加 Button 示例组件
fix(core): 修复 useChat abort 时状态未重置
docs(docs): 更新组件 API 文档
chore: 升级 vite 到 8.0
```

## 部署

### Docker 部署（推荐）

项目已包含多阶段构建的 Dockerfile：

```bash
# 构建镜像
docker build -t ai-chat-ui-docs .

# 运行容器
docker run -d -p 8080:80 ai-chat-ui-docs
```

构建流程：

1. **Stage 1 (Builder)**：Node 22 Alpine + pnpm 9，安装依赖后按依赖顺序构建 core → vue → markdown → docs
2. **Stage 2 (Production)**：Nginx Alpine，托管 docs 构建产物，配置 SPA 路由 fallback 和静态资源缓存

### 手动部署文档站

```bash
# 构建所有库包
pnpm build

# 构建文档站
pnpm -C packages/docs run build

# 预览构建结果
pnpm -C packages/docs run preview
```

构建产物位于 `packages/docs/dist`，可部署到 Vercel / GitHub Pages / Nginx 等任意静态托管。

## 包状态总览

| 包 | npm 包名 | 版本 | 状态 |
|------|------|------|------|
| core | `@ai-chat/core` | 0.0.1 | MVP — ChatAdapter 接口 + useChat + 工具函数 |
| vue | `@ai-chat/vue` | 0.0.1 | MVP — 6 个 Vue 3 组件 |
| markdown | `@ai-chat/markdown` | 0.0.1 | MVP — Markdown 渲染 + 代码高亮 + 公式 |
| docs | `@ai-chat/docs` | - (私有) | MVP — VitePress 文档站 + Playground |
| theme | `@ai-chat/theme` | - | 规划中 — Design Token 体系 + 暗色模式 + 主题预设 |
| agents | `@ai-chat/agents` | - | 规划中 — 多模型适配器 + Agent 调度 |
| tools | `@ai-chat/tools` | - | 规划中 — 工具注册 + 执行器 |
| server | `@ai-chat/server` | - | 规划中 — Hono HTTP 服务 + SSE |

## License

MIT
