# 服务端网关

前端组件库通过 `ChatAdapter` 与后端解耦，但真实项目总需要一个服务端：把浏览器的聊天请求转发给大模型 API，同时**让 API Key 只存在在服务端**。`@toimc/server` 就是这个网关——基于 [Hono](https://hono.dev) 的通用接收与转发层，配套 `@toimc/agents` 提供多模型协议适配。

```text
浏览器 → @toimc/vue 组件 → ChatAdapter（fetch SSE）
       → @toimc/server 网关（鉴权/限流/协议归一）
       → @toimc/agents 适配器（OpenAI 兼容 / Anthropic / 自定义 / mock）
       → 上游大模型 API
```

## 安装

```bash
pnpm add @toimc/server @toimc/agents
# Node 运行时再装服务适配器（Bun/Deno/边缘运行时不需要）
pnpm add @hono/node-server
```

## 最小可用网关

```ts
import { createChatGateway } from '@toimc/server'
import { serve } from '@hono/node-server'

const app = createChatGateway({
  models: [
    {
      id: 'deepseek-chat',
      provider: 'openai-compat', // OpenAI 兼容协议：OpenAI/DeepSeek/GLM/Kimi/OpenRouter 等
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: 'https://api.deepseek.com/v1',
      name: 'DeepSeek Chat',
      description: '性价比之选',
    },
  ],
})

serve({ fetch: app.fetch, port: 8787 })
```

三行核心：配置模型 → 创建网关 → 交给任意运行时监听。前端用文档站同款 [SSE Adapter](/mock-api)（`POST /api/chat` 消费 `StreamChunk` 流）即可对接。

## 多模型注册

`provider` 决定协议适配器，同一协议换 `baseURL` + `model` 即接入不同厂商：

```ts
import { ModelRegistry } from '@toimc/agents'

const registry = new ModelRegistry()
registry.register({
  id: 'gpt-5-mini',
  provider: 'openai-compat',
  model: 'gpt-5-mini',
  apiKey: process.env.OPENAI_API_KEY!,
})
registry.register({
  id: 'claude-sonnet',
  provider: 'anthropic', // Anthropic 原生 /v1/messages 协议
  model: 'claude-sonnet-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const app = createChatGateway({ models: registry })
```

`GET /api/models` 自动返回注册表视图（`id/name/description`，**永不泄漏 apiKey**），前端模型选择器直接消费。

### 自定义适配器

实现 `IModelAdapter`（`chat` + `chatStream`，流式产出 `StreamChunk`）即可接入任意后端——本仓库的 mock 演示服务就是这么做的：

```ts
import type { ChatRequest, ChatResponse, IModelAdapter } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'

const myAdapter: IModelAdapter = {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    /* 一次性返回 */
  },
  async *chatStream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    yield { type: 'text', content: '你好' }
    yield { type: 'done', content: '' }
  },
}

registry.registerAdapter('my-model', myAdapter, {
  name: '自定义模型',
  description: '走我自己的后端',
})
```

## 中间件选项

网关默认只开 CORS；鉴权与限流按需启用，均可单独 import 底层件挂到自己的 Hono 应用：

```ts
createChatGateway({
  models,
  basePath: '/api', // 路由前缀，默认 '/api'
  cors: true, // 默认开
  logging: true, // hono/logger 请求日志，默认关
  auth: { tokens: [process.env.GATEWAY_TOKEN!] }, // Bearer 认证，默认关（/health 不受影响）
  rateLimit: { windowMs: 60_000, max: 30 }, // 内存限流，默认关
  defaultModel: 'gpt-5-mini', // 请求不带 model 时的缺省
})
```

## 流收尾钩子 onComplete

流式过程中网关按 chunk 类型累积出完整的助手消息（text 拼接、thinking 归集、tool_call/tool_result 自动配对），流结束（含客户端中止）回调，适合落库或审计：

```ts
createChatGateway({
  models,
  chat: {
    onComplete(result) {
      // result.body        原始请求体（conversationId 等透传字段在内）
      // result.model       本轮使用的模型 id
      // result.assistant   { id, content, thinking?, toolCalls?, createdAt }
      // result.durationMs  耗时；result.aborted 客户端是否中止
      await saveMessage(result.body.conversationId!, result.assistant)
    },
  },
})
```

## 线协议

`POST /api/chat` 请求体 `{ messages, model?, ...rest }`——`messages`/`model` 之外的任意字段（如 `speed`、`conversationId`）会整体透传给适配器的 `ChatRequest.passthrough`，网关不解释。响应为 SSE：每帧 `event: chunk` + `data: <StreamChunk JSON>`，`done` 收尾，出错时以 `error` chunk 收尾保持可解析。完整接口说明见[接口文档](/mock-api)。

## 部署

网关只导出 fetch 风格的 Hono app，运行时自选：

- **Node**：`@hono/node-server`（上文示例）
- **Vercel**：`api/index.ts` 里 `export const POST = handle(app)`（本项目线上演示即此形态）
- **Bun / Deno / Workers**：对应 runtime adapter 直接挂 `app.fetch`

`@toimc/agents` 零外部依赖（原生 fetch），可脱离网关单独用于脚本、批处理等纯逻辑场景。
