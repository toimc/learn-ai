---
layout: home

hero:
  name: AI Chat UI
  text: 把 ChatGPT 的界面，装进你的 Vue 应用
  tagline: 62 个可组合组件 + 一个 ChatAdapter 接口——思考链、工具调用、RAG 引用、生成式 UI 开箱即用。OpenAI、Anthropic、GLM、Ollama、自建网关，后端任选。MIT 开源。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 组件总览
      link: /components/conversation
    - theme: alt
      text: 在线演示
      link: /playground
    - theme: alt
      text: GitHub
      link: https://github.com/ai-chat-ui/ai-chat-ui
---

<script setup>
import HomeStats from './.vitepress/components/HomeStats.vue'
import HomeWhy from './.vitepress/components/HomeWhy.vue'
import HomeFeatureGrid from './.vitepress/components/HomeFeatureGrid.vue'
import HomeArch from './.vitepress/components/HomeArch.vue'
import HomeCompare from './.vitepress/components/HomeCompare.vue'
import HomeDemos from './.vitepress/components/HomeDemos.vue'
</script>

<div class="home-hero-note">
  右侧不是录屏，是本页正在用 <code>@toimc/vue</code> 真组件循环播放的活演示——思考链、工具调用、流式回答、RAG 引用，一个不缺。
</div>

## 01 · 为什么是现在

Vue 生态并不缺 AI 的「逻辑层」，缺的是一套不绑后端、不绑 Tailwind、可以拆开来用的 AI 聊天界面。三个来自 2026-10 公开数据的信号：

<HomeWhy />

## 02 · 项目数据

<HomeStats />

全部数字来自仓库实测：组件数按 `@toimc/vue` 的 index.ts 导出统计，测试用例按 173 个测试文件中的 `it/test` 计数（另含 22 个 Playwright E2E 用例），core 包零运行时依赖、agents 包零外部依赖。

## 03 · 三步跑起来

**第一步，安装。** 五个包按需组合，最小只要两个：

```bash
pnpm add @toimc/core @toimc/vue @toimc/markdown
```

样式一次性引入（Design Token + 全部组件样式，零 CSS 框架）：

```ts
import '@toimc/vue/style.css'
```

**第二步，实现一个 ChatAdapter。** 前端只认这一个接口——`sendMessage` 返回 `AsyncGenerator<StreamChunk>`，接谁由你决定：

```ts
import type { ChatAdapter } from '@toimc/core'

const adapter: ChatAdapter = {
  async *sendMessage({ messages, signal }) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal, // 中止信号自动透传
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
```

对接 OpenAI 兼容协议、加思考帧、走 SSE，[用法指南](/guide/usage)里有现成的完整实现；服务端想省事，[`@toimc/agents`](/guide/server) 内置 OpenAI 兼容 / Anthropic 协议适配器。

**第三步，组装界面。** 布局、滚动锚定、流式光标、中断切换，全部内置：

```vue
<script setup lang="ts">
import { useChat } from '@toimc/core'
import {
  Conversation, ConversationContent,
  Message, MessageContent,
  PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit,
} from '@toimc/vue'

const chat = useChat(adapter)
</script>

<template>
  <Conversation>
    <ConversationContent>
      <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
        <MessageContent :content="msg.content" :streaming="chat.isStreaming" />
      </Message>
    </ConversationContent>

    <PromptInput :disabled="chat.isStreaming" @send="(p) => chat.send(p.text)" @abort="chat.abort">
      <PromptInputBody>
        <PromptInputTextarea />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
  </Conversation>
</template>
```

完整可复制版本（含 Markdown 渲染注入、附件、思考链）见[快速开始](/guide/getting-started)。

## 04 · 62 个组件，16 项开箱能力

<HomeFeatureGrid />

## 05 · 架构：一个接口，任意后端

组件不关心模型，`useChat` 不关心协议，你的应用只依赖 `ChatAdapter` 这一层薄接口。换模型 = 换一个 adapter 文件；API Key 永远留在服务端。

<HomeArch />

## 06 · 与主流方案对比

React 生态的同类库很多，但「Vue 原生 + 后端无关 + 组件可拆用」三者同时成立的，目前只有这一家：

<HomeCompare />

## 07 · 在线演示，点开即玩

以下页面全部由本库组件搭建。「纯静态」演示无需任何后端，「需 dev-server」的页面在仓库里跑 `pnpm dev` 即可获得完整体验：

<HomeDemos />

## 08 · 包矩阵：按需安装，不背包袱

| 包 | 版本 | 职责 | 什么时候装它 |
| --- | --- | --- | --- |
| `@toimc/core` | 0.0.2 | 类型 + `useChat` 状态机，**零运行时依赖** | 必装 |
| `@toimc/vue` | 0.0.2 | 62 个组件、主题令牌、i18n | 必装 |
| `@toimc/markdown` | 0.0.2 | 流式 Markdown / Shiki 高亮 / KaTeX / Mermaid | 要渲染 Markdown 时 |
| `@toimc/agents` | 0.2.0 | 服务端模型适配层（OpenAI 兼容 / Anthropic / Mastra），零外部依赖 | 自建后端时 |
| `@toimc/server` | 0.1.1 | Hono 网关：Bearer 认证、限流、SSE 转发、JWT / API Key / 每日配额 | 要现成服务端时 |

从界面到生产，链路是通的：[服务端网关](/guide/server)数行起一个带认证与限流的聊天网关；[智能体接入](/guide/mastra)一行 `createMastraGateway` 挂载 Mastra Agent（工具调用 + 会话记忆）；[语义检索](/guide/rag)演示 Ollama 本地向量化 + 混合检索的完整 RAG；[会话记忆](/guide/memory)讲透 LibSQL 落盘与 token 成本取舍。仓库还内置 MCP 双向接入（Context7 客户端 + 把本地工具暴露给 Claude Code）与多 Agent 编排的参考实现。

## 09 · 现在就开始

```bash
pnpm add @toimc/core @toimc/vue
```

三分钟得到一个能流的聊天界面，剩下的零件——思考链、工具审批、引用角标、生成式 UI——在[组件文档](/components/conversation)里随取随用。

<div class="home-cta">
  <a class="home-cta__btn home-cta__btn--brand" href="/guide/getting-started">读快速开始</a>
  <a class="home-cta__btn" href="/playground">先去 Playground 玩</a>
  <a class="home-cta__btn" href="https://github.com/ai-chat-ui/ai-chat-ui">GitHub · MIT</a>
</div>

<style scoped>
.home-hero-note {
  margin: -6px auto 34px;
  max-width: 688px;
  text-align: center;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

.home-hero-note code {
  font-size: 12px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 1px 6px;
  border-radius: 4px;
}

.home-cta {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.home-cta__btn {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.home-cta__btn:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.home-cta__btn--brand {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}

.home-cta__btn--brand:hover {
  background: var(--vp-c-brand-2);
}
</style>
