# 快速开始

## 概述

AI Chat UI 是一个后端无关的 AI 聊天界面组件库。通过 `ChatAdapter` 接口适配任何 AI 后端（OpenAI、Claude、自建 API 等），组件库本身不依赖任何特定的 API 提供商。

## 前置条件

- Node.js >= 18
- pnpm >= 9
- Vue 3.5+

## 安装

```bash
# 安装核心包（必须）
pnpm add @ai-chat/core

# 安装 Vue 组件（必须）
pnpm add @ai-chat/vue

# 安装 Markdown 渲染（可选）
pnpm add @ai-chat/markdown
```

如需渲染 LaTeX 公式，额外手动引入 KaTeX 样式（可选，不影响其他功能）：

```ts
import '@ai-chat/markdown/katex.css'
```

## 最小示例

```vue
<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import type { ChatAdapter } from '@ai-chat/core'
import {
  ChatWindow,
  MessageList,
  MessageBubble,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@ai-chat/vue'
import { MarkdownRenderer } from '@ai-chat/markdown'

// 1. 实现 ChatAdapter 接口
const adapter: ChatAdapter = {
  async *sendMessage({ messages }) {
    // 对接你的 AI 后端
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

// 2. 使用 useChat composable
const chat = useChat(adapter)
</script>

<template>
  <!-- 3. 组装组件 -->
  <ChatWindow>
    <MessageList v-slot="{ message }" :messages="chat.messages">
      <MessageBubble :message="message">
        <MarkdownRenderer :content="message.content" />
      </MessageBubble>
    </MessageList>
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

## 下一步

- [安装](/guide/installation) — 各包详细安装说明
- [使用指南](/guide/usage) — ChatAdapter 模式详解
- [主题定制](/guide/theming) — CSS 变量自定义
- [Playground](/playground) — 在线体验完整功能
