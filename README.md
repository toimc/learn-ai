# ai-chat-ui

后端无关的 AI 聊天界面组件库，基于 Vue 3 + TypeScript + Vite。

## 特性

- **Provider 抽象层**：通过 `ChatAdapter` 接口对接任何 AI 后端（OpenAI / Claude / 自建 API）
- **流式输出**：基于 `AsyncGenerator` 的流式文本渲染
- **Monorepo 按需使用**：每个包独立发布，只装需要的
- **零 CSS 依赖**：CSS Variables 主题定制，不绑定任何 CSS 框架
- **组件级状态**：`provide/inject` 管理状态，支持同一页面多个独立对话

## 安装

```bash
pnpm add @ai-chat/core @ai-chat/vue @ai-chat/markdown
```

## 快速开始

```vue
<script setup>
import { useChat } from '@ai-chat/core'
import { ChatWindow, MessageList, MessageBubble, InputArea } from '@ai-chat/vue'
import { MarkdownRenderer } from '@ai-chat/markdown'
import { myAdapter } from './adapter'

const { messages, isStreaming, send, abort } = useChat(myAdapter)
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

## 自定义 Adapter

```typescript
import type { ChatAdapter, SendMessageOptions, StreamChunk } from '@ai-chat/core'

const myAdapter: ChatAdapter = {
  async *sendMessage({ messages, signal }: SendMessageOptions): AsyncGenerator<StreamChunk> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield { type: 'text', content: decoder.decode(value, { stream: true }) }
    }

    yield { type: 'done', content: '' }
  }
}
```

## 包结构

| 包 | 说明 | 状态 |
|------|------|------|
| `@ai-chat/core` | ChatAdapter 接口 + useChat composable + 流式处理 | MVP |
| `@ai-chat/vue` | ChatWindow / MessageList / MessageBubble / InputArea / StreamText | MVP |
| `@ai-chat/markdown` | Markdown 渲染 + Shiki 代码高亮 + KaTeX 公式 | MVP |
| `@ai-chat/multimodal` | 文件上传 + 图片预览（Phase 2） | 规划中 |
| `@ai-chat/agent` | 工具调用展示 + 思维链可视化（Phase 2） | 规划中 |

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动文档站点
pnpm build          # 构建所有包
pnpm test           # 运行测试
pnpm lint           # 代码检查
pnpm type-check     # 类型检查
```

## 技术栈

Vue 3.5+ / TypeScript 5.x / Vite 6.x / pnpm 9.x / Vitest / ESLint

## License

MIT
