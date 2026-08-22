# 智能体接入

[服务端网关](/guide/server)的各 provider 都是纯模型转发——收消息、调模型、回流。当应用需要**工具调用、会话记忆**这类 Agent 能力时，接入 [Mastra](https://mastra.ai)。本仓库提供**两条链路**，映射表完全同构（Mastra 原生事件 → StreamChunk），前端组件与 `useChat` 零改动：

|              | 链路一：服务端注册（8787）                        | 链路二：mastra-app 直连（4111）                                 |
| ------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| 定位         | 组件库**官方接入方式**，快速给网关模型加工具/记忆 | Mastra **全家桶主力工程**（Studio / workflows / observability） |
| 协议转换位置 | 服务端（`@toimc/agents/mastra` 在网关内转协议）   | 前端（Playground 内置 MastraAdapter 转协议）                    |
| 宿主依赖     | 网关侧装 `@mastra/core`，前端零 Mastra 感知       | 跑本仓库 `packages/mastra-app`（标准 Mastra 工程）              |
| 适用场景     | 已有 `@toimc/server` 网关，多模型统一管理         | 以 Mastra 为核心建应用，要用 Studio 监控与 workflows            |
| 端点         | `POST /api/chat`（StreamChunk 直传）              | `POST /api/agents/chat-agent/stream`（Mastra 原生事件流）       |

## 链路一：服务端注册进网关（8787）

```text
浏览器 → @toimc/vue 组件 → ChatAdapter（fetch SSE）
       → @toimc/server 网关（鉴权/限流/协议归一）
       → @toimc/agents/mastra（MastraAdapter 事件映射）
       → Mastra Agent（工具调用 ReAct 循环 + 会话记忆）
       → 上游大模型 API
```

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
    storage: new LibSQLStore({
      id: 'mastra-memory',
      url: 'file:.temp/mastra.db',
    }),
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

### mock-server 环境变量

本仓库 mock-server 即此链路的完整示例（[mock 服务演示](/mock-server-demo)），env 门控、随装随卸：

| 环境变量            | 说明                                                                                                  | 示例                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `MASTRA_MODEL`      | 存在才注册 `mastra-agent` 模型；缺省时行为与纯 mock 完全一致                                          | `deepseek/deepseek-chat`              |
| `MASTRA_MODEL_URL`  | 可选；OpenAI 兼容自定义端点，传入后 `model` 走 `{ id, url }` 对象形态                                 | `https://your-gateway.example.com/v1` |
| `MASTRA_MODEL_NAME` | 可选；模型列表展示名，缺省 `Mastra Agent`                                                             | `DeepSeek Agent`                      |
| `MASTRA_TELEMETRY`  | `true` 时构造 `Mastra` 实例并开 telemetry，配合 `npx mastra dev` 起 Studio 监控面板（默认 4111 端口） | `true`                                |

记忆落盘在 `file:.temp/mastra.db`（相对 mock-server 包目录，启动时自动建目录），进程重启对话保留。API Key 缺失时 Mastra 直接抛明确错误（如 `Could not find API key process.env.DEEPSEEK_API_KEY`），以 `error` chunk 展示在前端，SSE 流仍完整可解析。

运行时注册（浏览器 `POST /api/providers` 即刻组装）与环境变量注册的差异见[服务端网关](/guide/server#运行时注册-vs-环境变量注册)。

## 链路二：mastra-app 直连（4111）

`packages/mastra-app` 是本仓库的 **Mastra 标准工程**（不依赖任何 `@toimc/*` 包）：`@mastra/hono` 自动挂载 `/api/agents/*` 原生端点，内置 `chat-agent`（真实模型 + `get_time` / `get_weather` 工具 + LibSQL 记忆）与 Studio。Playground 的前端 MastraAdapter 直连它的原生事件流：

```text
浏览器 → @toimc/vue 组件 → MastraAdapter（前端事件映射，Playground 内置）
       → mastra-app 4111 /api/agents/chat-agent/stream（Mastra 原生端点）
       → Mastra Agent（工具调用 + LibSQL 会话记忆）
       → 上游大模型 API
```

### 快速开始

```bash
cd packages/mastra-app
cp .env.example .env    # 填 MASTRA_APP_MODEL 与模型路由约定的 API Key（如 DEEPSEEK_API_KEY）
corepack pnpm dev       # 起 4111（tsx watch 热重载）

# 验证：列出 agent
curl http://localhost:4111/api/agents
# 应返回包含 chat-agent 的列表
```

Studio 监控面板（对话调试、thread 查看）：

```bash
corepack pnpm studio    # mastra studio，默认连本进程 4111
```

### 环境变量（`packages/mastra-app/.env`）

| 环境变量               | 说明                                                         | 示例                                  |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `MASTRA_APP_MODEL`     | 必填；缺失时启动报可读错误。`provider/model` 路由串          | `deepseek/deepseek-chat`              |
| `MASTRA_APP_MODEL_URL` | 可选；OpenAI 兼容自定义端点，传入后走 `{ id, url }` 对象形态 | `https://your-gateway.example.com/v1` |
| `MASTRA_APP_TOKEN`     | 可选；设置后 `/api/*` 需带 `Authorization: Bearer <token>`   | `s3cret`                              |
| `MASTRA_APP_PORT`      | 可选；监听端口，缺省 `4111`                                  | `4111`                                |
| `MASTRA_APP_TELEMETRY` | 可选；遥测开关                                               | `false`                               |

模型 API Key 按 Mastra 路由约定的环境变量命名（如 `DEEPSEEK_API_KEY`），只放在 mastra-app 的 `.env`（不提交）。记忆落盘 `file:.temp/mastra-app.db`，与 mock-server 的 `mastra.db` 互不干扰。

### 在 Playground 使用

打开 [Playground](/playground)，顶栏**模型下拉左侧**有后端选择器（本地 Mock / mock-server · 8787 / Mastra · 4111）：

- 切到 **Mastra · 4111** 后新建会话即走链路二；选择持久化在 `localStorage`（`pg.backend`）
- 切换时自动探活（`GET /api/agents`，2s 超时），不可达的选项标「离线」禁用；服务恢复后重选即可
- Mastra 会话**隐藏模型下拉**，显示固定 agent 标签——模型由服务端决定（`.env` 静态配置，或[运行时表单配置](#运行时配置模型-免重启)），前端不选
- 会话创建时快照后端（与[模型选择](/guide/server#运行时注册-vs-环境变量注册)同语义）：切换只影响新会话，已有会话保持原链路
- 请求携带全量 `messages` + `memory: { thread: 会话id, resource: 'ai-chat-playground' }`，Mastra 按线程补全历史
- `abort` 中断静默无错误残留；4111 停机时发送按既有错误路径提示

### 运行时配置模型（免重启）

`.env` 静态模型适合长期默认配置；切换模型（换中转站、换 key、对比模型效果）时改 `.env` 重启的反馈回路太长。`/api/app/model` 提供**单条运行时配置**：表单提交即刻组装带工具与会话记忆的 `custom-agent`，**免重启生效**：

```bash
# 配置（openai-compat 中转示例；anthropic 传 provider/model/apiKey 即可）
curl -X POST http://localhost:4111/api/app/model \
  -H 'content-type: application/json' \
  -d '{
    "name": "2api 中转",
    "provider": "openai-compat",
    "baseURL": "https://your-gateway.example.com/v1",
    "apiKey": "sk-xxx",
    "model": "gpt-5.6-terra"
  }'
# → {"ok":true}

# 查看当前配置（脱敏视图，绝不回 apiKey）
curl http://localhost:4111/api/app/model
# → {"config":{"name":"2api 中转","provider":"openai-compat","model":"gpt-5.6-terra","baseURL":"..."}}

# 清空（回到 .env 静态模型）
curl -X DELETE http://localhost:4111/api/app/model
```

行为要点：

- **未配置时回退**：Mastra 会话默认走 `.env` 配置的 `chat-agent`；存在运行时配置时自动切到 `POST /api/app/agents/custom-agent/stream`（Mastra 原生 SSE，前端适配器同款线格式）。清空配置后新会话自动回到 `chat-agent`
- **换模型不丢记忆**：`custom-agent` 与换模型前后共用同一 LibSQL 记忆实例，thread 历史连续
- **安全**：apiKey 只进服务端进程内存（openai-compat 显式进 model 对象、anthropic 注入 `ANTHROPIC_API_KEY`），不落盘、不进日志、不进任何 GET 响应；配置与流式端点同受可选的 `MASTRA_APP_TOKEN` Bearer 保护
- **Playground 集成**：后端选 **Mastra · 4111** 时打开 Provider 设置弹层即此配置（同一表单组件，提交目标自动分流到 4111）；保存/删除后新发送即刻切端点，**已开始的流不受影响**（发送时快照，语义同会话切换）
- 运行时配置存于进程内存，重启后归零（回到 `.env`）；长期使用的模型请固化到 `.env`

### 端口互斥

mock-server 的 `npx mastra dev`（Studio 调试模式）与 mastra-app **同占 4111**，二者互为替代、不能同时运行；需要同时跑 8787 与 4111 时，mock-server 侧不要开 `MASTRA_TELEMETRY` 的 Studio。

## 流事件映射（两条链路同构）

适配层消费 Mastra 原生流 chunk（`{ type, payload }`）映射为 StreamChunk 线协议，前端组件自动展示：

| Mastra 流事件                              | StreamChunk                                              | 前端展示                                                           |
| ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `text-delta`                               | `text`                                                   | 正文流式渲染                                                       |
| `reasoning-delta`                          | `thinking`                                               | [ThinkingBlock](/components/message) 折叠思考块，done 时自动算耗时 |
| `tool-call-input-streaming-start` / `-end` | `tool_call` 双帧（起点帧带 id + name，结束帧带完整参数） | [ToolCall](/components/tool-call) 可折叠面板                       |
| `tool-result` / `tool-error`               | `tool_result`（`isError` 映射错误态）                    | ToolCall 面板的输出 / 错误区                                       |
| `error`                                    | `error` 后终止                                           | 消息内错误提示                                                     |
| `start` / `step-*` / `raw` / `source` 等   | 丢弃                                                     | ——                                                                 |

双帧 `tool_call` 由消费端按 `toolCallId` 原位合并——core 的 `useChat` 与网关 collector 均支持，最终只呈现一个工具条目（其他适配器发双帧同样受益）。

两条链路的唯一行为差异在**收尾**：8787 网关保证发 `done` 帧；4111 原生端点以 `finish` 事件收尾（映射为 `done`），流自然结束但无 `finish` 时由前端适配器**自补 `done`**。

## 会话记忆（链路一）

- 前端请求透传的 `conversationId` 自动映射为 Mastra 的 `memory.thread`：同一会话的上下文由 Agent 记忆补全
- 未传时每轮生成独立 thread（`mastra_thread_` 前缀），不跨轮记忆
- `resource`（默认 `'ai-chat'`）是 Mastra 记忆的命名空间，多用户场景可按用户区分
- 是否透传记忆由运行时探测（`agent.hasOwnMemory()`）：`createMastraModel` 未配置 `memory` 时不会触发 Mastra 记忆装配
