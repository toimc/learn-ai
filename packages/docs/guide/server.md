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

## Mastra Agent 接入

上文各 provider 都是纯模型转发——收消息、调模型、回流。当应用需要**工具调用、会话记忆**这类 Agent 能力时，接入 [Mastra](https://mastra.ai)：`@toimc/agents/mastra` 子路径把 Mastra `Agent` 包装成标准 `IModelAdapter`，注册进网关后前端组件照常消费 StreamChunk，不感知后端是裸模型还是 Agent。

### 安装

`@mastra/core` 是 `@toimc/agents` 的**可选 peer 依赖**：不用 mastra 子路径就不需要安装，主入口（`@toimc/agents`）完全不受影响；用到子路径时才装。未安装时 `@toimc/agents/mastra` 模块本身仍可正常加载，只有调用 `createMastraModel` 构造 Agent 时才会抛出含安装指引（`pnpm add @mastra/core`）的友好错误。

```bash
pnpm add @toimc/agents @mastra/core @mastra/memory @mastra/libsql zod
```

`@mastra/memory` + `@mastra/libsql` 用于会话记忆落盘（不需要记忆可省去），`zod` 用于工具入参 schema。仓库按 `@mastra/core ^1.60.0` 验证（peer 范围 `^1.60.0`）。

### 注册 Agent 模型

`createMastraModel(config)` 声明式构造，返回 `{ adapter, info, agent }`（`Promise`，需 `await`——内部动态加载 `@mastra/core` 以支持可选 peer），直接喂 `registry.registerAdapter`。注册发生在应用启动阶段：`await createMastraModel(...)` 完成后再建网关，模型注册先于第一个请求即可：

```ts
import { createChatGateway } from '@toimc/server'
import { ModelRegistry } from '@toimc/agents'
import { createMastraModel } from '@toimc/agents/mastra'
import { createTool } from '@mastra/core/tools'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { z } from 'zod'

// 工具：zod 定义入参 schema，Mastra 调用前自动校验
const getTimeTool = createTool({
  id: 'get_time',
  description: '获取指定时区的当前时间；不传 timezone 则用系统本地时间',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA 时区名，如 Asia/Shanghai'),
  }),
  execute: async ({ timezone }) => {
    const now = new Date()
    return {
      iso: now.toISOString(),
      formatted: timezone
        ? now.toLocaleString('zh-CN', { timeZone: timezone })
        : now.toLocaleString('zh-CN'),
    }
  },
})

// 'provider/model' 字符串走 Mastra 模型路由，API Key 读约定环境变量（此处 DEEPSEEK_API_KEY）
const { adapter, info } = await createMastraModel({
  id: 'mastra-agent',
  name: 'Mastra Agent',
  description: '支持工具调用与会话记忆',
  model: 'deepseek/deepseek-chat',
  instructions: '你是演示 Agent。需要时间信息时调用工具，回答保持简洁。',
  tools: { getTimeTool },
  memory: new Memory({
    // LibSQL 本地文件库；父目录需已存在
    storage: new LibSQLStore({ id: 'mastra-memory', url: 'file:.temp/mastra.db' }),
  }),
})

const registry = new ModelRegistry()
registry.registerAdapter('mastra-agent', adapter, info)

const app = createChatGateway({ models: registry })
```

`model` 字段支持三种形态：

```ts
// 1. 'provider/model' 字符串：Mastra 模型路由（见上例）
model: 'deepseek/deepseek-chat'

// 2. { id, url, apiKey? } 对象：OpenAI 兼容自定义端点（自建网关 / 中转）
model: { id: 'custom/my-model', url: 'https://your-gateway.example.com/v1' }

// 3. AI SDK provider 实例：宿主自行构造后直接传入
model: myLanguageModel
```

### 流事件映射

适配器消费 Mastra 原生流 chunk（`{ type, payload }`）映射为 StreamChunk 线协议，前端组件自动展示：

| Mastra 流事件 | StreamChunk | 前端展示 |
| --- | --- | --- |
| `text-delta` | `text` | 正文流式渲染 |
| `reasoning-delta` | `thinking` | [ThinkingBlock](/components/message) 折叠思考块，done 时自动算耗时 |
| `tool-call-input-streaming-start` / `-end` | `tool_call` 双帧（起点帧带 id + name，结束帧带完整参数） | [ToolCall](/components/tool-call) 可折叠面板 |
| `tool-result` / `tool-error` | `tool_result`（`isError` 映射错误态） | ToolCall 面板的输出 / 错误区 |
| `error` | `error` 后终止 | 消息内错误提示 |

双帧 `tool_call` 由消费端按 `toolCallId` 原位合并——core 的 `useChat` 与网关 collector 均支持，最终只呈现一个工具条目（其他适配器发双帧同样受益）。

### 会话记忆

- 前端请求透传的 `conversationId` 自动映射为 Mastra 的 `memory.thread`：同一会话的上下文由 Agent 记忆补全
- 未传时每轮生成独立 thread（`mastra_thread_` 前缀），不跨轮记忆
- `resource`（默认 `'ai-chat'`）是 Mastra 记忆的命名空间，多用户场景可按用户区分
- 是否透传记忆由运行时探测（`agent.hasOwnMemory()`）：`createMastraModel` 未配置 `memory` 时不会触发 Mastra 记忆装配

### mock-server 环境变量

本仓库 mock-server 即此接入的完整示例（[mock 服务演示](/mock-server-demo)），env 门控、随装随卸：

| 环境变量 | 说明 | 示例 |
| --- | --- | --- |
| `MASTRA_MODEL` | 存在才注册 `mastra-agent` 模型；缺省时行为与纯 mock 完全一致 | `deepseek/deepseek-chat` |
| `MASTRA_MODEL_URL` | 可选；OpenAI 兼容自定义端点，传入后 `model` 走 `{ id, url }` 对象形态 | `https://your-gateway.example.com/v1` |
| `MASTRA_MODEL_NAME` | 可选；模型列表展示名，缺省 `Mastra Agent` | `DeepSeek Agent` |
| `MASTRA_TELEMETRY` | `true` 时构造 `Mastra` 实例并开 telemetry，配合 `npx mastra dev` 起 Studio 监控面板（默认 4111 端口） | `true` |

记忆落盘在 `file:.temp/mastra.db`（相对 mock-server 包目录，启动时自动建目录），进程重启对话保留。API Key 缺失时 Mastra 直接抛明确错误（如 `Could not find API key process.env.DEEPSEEK_API_KEY`），以 `error` chunk 展示在前端，SSE 流仍完整可解析。

### 运行时注册 vs 环境变量注册

上文 `MASTRA_MODEL` 是**启动时**经环境变量注册（id 固定 `mastra-agent`）；mock-server 还提供**运行时**注册：浏览器把表单配置 `POST /api/providers` 上来，服务端即刻组装注册（id 递增 `custom-{n}`，进程内存计数）。两条路径写进**同一个 registry**，并存不冲突，`GET /api/models` 里都可见：

| | 环境变量注册 | 运行时注册（API） |
| --- | --- | --- |
| 触发时机 | 进程启动（`readMastraEnv` 探测） | 请求到达（`POST /api/providers`） |
| 模型 id | `mastra-agent` | `custom-{n}` 递增（重启归零） |
| 配置来源 | `MASTRA_MODEL` / `MASTRA_MODEL_URL` 等 env | 请求体（`ProviderFormPayload`：name / provider / baseURL / apiKey / model） |
| 密钥去向 | 环境变量 | 服务端内存：不落盘、不进日志、不进任何 GET 响应 |
| 注销 | 无（进程级） | `DELETE /api/providers/:id` |

组装逻辑在 `registerRuntimeProvider`（`packages/mock-server/src/mastra/register.ts`），按协议类型走 `createMastraModel` 的两种 `model` 形态：

```ts
// openai-compat：{ id, url, apiKey } 对象（OpenAI 兼容自定义端点）
model: { id: payload.model, url: payload.baseURL, apiKey: payload.apiKey }

// anthropic：'anthropic/{model}' 路由串，注册前把密钥注入 env（Mastra 官方路由从 env 取）
process.env.ANTHROPIC_API_KEY = payload.apiKey
model: `anthropic/${payload.model}`
```

两条路径注册的模型都自动挂上 `get_time` / `get_weather` 两个演示工具与同一个 LibSQL 记忆（`file:.temp/mastra.db`），因此运行时注册的模型天然支持工具调用与会话记忆。注册**不做上游连通性校验**（惰性连接）：首次对话才真连上游，密钥错误 / 端点不通等失败按既有路径以 `error` chunk 呈现，SSE 流仍完整可解析。

三端点契约（POST 校验失败 400、成功 201、DELETE 404、响应脱敏）见[接口文档](/mock-api#provider-运行时注册)；前端表单组件见 [ProviderSettingsDialog](/components/provider-settings-dialog)，端到端体验在 [Playground](/playground)。

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
