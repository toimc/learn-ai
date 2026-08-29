# 智能体接入

[服务端网关](/guide/server)的各 provider 都是纯模型转发——收消息、调模型、回流。当应用需要**工具调用、会话记忆**这类 Agent 能力时，接入 [Mastra](https://mastra.ai)：`@toimc/server/mastra` 子路径把 agent 定义组装进网关，`@toimc/agents/mastra` 在内部把 Mastra 原生事件映射为 `StreamChunk`，前端组件与 `useChat` 零改动。

```text
浏览器 → @toimc/vue 组件 → ChatAdapter（fetch SSE）
       → @toimc/server 网关（/mastra 子路径组装，鉴权/限流/协议归一）
       → @toimc/agents/mastra（MastraAdapter 事件映射）
       → Mastra Agent（工具调用 ReAct 循环 + 会话记忆）
       → 上游大模型 API
```

## 安装

`@mastra/core` 是 `/mastra` 子路径的**可选 peer 依赖**（`@toimc/agents` 与 `@toimc/server` 同款语义）：不用子路径就不需要安装，两个包的主入口完全不受影响；用到时才装。未安装时子路径模块本身仍可正常加载，只有构建 Agent 时才会抛出含安装指引（`pnpm add @mastra/core`）的友好错误。

```bash
pnpm add @toimc/server @toimc/agents @mastra/core @mastra/memory @mastra/libsql zod
```

`@mastra/memory` + `@mastra/libsql` 用于会话记忆落盘（不需要记忆可省去），`zod` 用于工具入参 schema。仓库按 `@mastra/core ^1.60.0` 验证（peer 范围 `^1.60.0`）。

## 一行组装：createMastraGateway

`@toimc/server/mastra` 导出 `createMastraGateway(options)`：静态模型与 mastra agent 定义一起喂进去，返回可直接监听的 Hono app。agent 定义（`MastraAgentDefinition`）是**纯配置对象**，不含任何 Mastra 类型依赖：

```ts
import { createMastraGateway } from '@toimc/server/mastra'
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

const { app, registry } = await createMastraGateway({
  models: [
    // 静态模型（mock 剧本、普通 provider 转发等），形态与 createChatGateway 一致
    { id: 'mock-pro', provider: 'openai-compat', model: 'mock', apiKey: 'unused' },
  ],
  agents: [
    {
      // 网关模型 id：/api/models 列表项与前端 model 参数
      id: 'chat-agent',
      name: 'Chat Agent',
      description: '支持工具调用与会话记忆',
      // 'provider/model' 字符串走 Mastra 模型路由，API Key 读约定环境变量（此处 DEEPSEEK_API_KEY）
      model: 'deepseek/deepseek-chat',
      instructions: '你是演示 Agent。需要时间信息时调用工具，回答保持简洁。',
      tools: { getTimeTool },
      // Memory 实例工厂（惰性：注册时调用一次；不传则无记忆）
      memory: () =>
        new Memory({
          storage: new LibSQLStore({ id: 'chat-memory', url: 'file:.temp/chat.db' }),
        }),
    },
  ],
})
```

行为要点：

- **注册即可见**：每个 agent 定义逐个构建（内部走 `createMastraModel`，动态加载 `@mastra/core`）并注册为网关模型，`GET /api/models` 直接列出，前端 `POST /api/chat` 传 `model: 'chat-agent'` 即用
- **构建失败整体抛错**：依赖缺失 / env 非法时抛出含 agent id 的可读错误——启动即失败优于静默降级
- **网关选项透传**：`models` 之外的选项（`auth` / `rateLimit` / `chat.onComplete` 等）与 [`createChatGateway`](/guide/server#中间件选项) 完全一致
- `model` 字段支持 `'provider/model'` 路由串与 `{ id, url, apiKey? }` 对象（OpenAI 兼容自定义端点）两种形态

## 细粒度：createMastraModel 手动注册

不想引入 `@toimc/server` 时，可直接用 `@toimc/agents/mastra` 的 `createMastraModel(config)`：声明式构造，返回 `{ adapter, info, agent }`（`Promise`，需 `await`——内部动态加载 `@mastra/core` 以支持可选 peer），手动喂 `registry.registerAdapter`。注册发生在应用启动阶段：`await` 完成后再建网关，模型注册先于第一个请求即可：

```ts
import { ModelRegistry } from '@toimc/agents'
import { createMastraModel } from '@toimc/agents/mastra'

const { adapter, info } = await createMastraModel({
  id: 'chat-agent',
  name: 'Chat Agent',
  description: '支持工具调用与会话记忆',
  model: 'deepseek/deepseek-chat',
  instructions: '你是演示 Agent。需要时间信息时调用工具，回答保持简洁。',
  tools: { getTimeTool }, // createTool 产物，同上例
})

const registry = new ModelRegistry()
registry.registerAdapter('chat-agent', adapter, info)
```

`model` 字段三种形态：

```ts
// 1. 'provider/model' 字符串：Mastra 模型路由（见上例）
model: 'deepseek/deepseek-chat'

// 2. { id, url, apiKey? } 对象：OpenAI 兼容自定义端点（自建网关 / 中转；
//    url 场景 Mastra 不自动读 provider env，key 须显式传入）
model: { id: 'custom/my-model', url: 'https://your-gateway.example.com/v1', apiKey: 'sk-xxx' }

// 3. AI SDK provider 实例：宿主自行构造后直接传入
model: myLanguageModel
```

## dev-server：本仓库的完整示例

本仓库 `packages/dev-server` 即 `createMastraGateway` 的完整示例（[Mock 服务端演示](/mock-server-demo)）：**env 门控、随装随卸**——`MASTRA_MODEL` 存在才注册 `chat-agent` 与 `docs-agent`（组件库助手，挂 `search_docs` 文档检索工具；配置 `CONTEXT7_API_KEY` 后额外获得 context7 外部库文档查询工具），缺省时是纯 mock 模式（零 mastra 依赖启动）。

| 环境变量               | 说明                                                                   | 示例                                  |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `MASTRA_MODEL`         | 存在才注册 `chat-agent` 与 `docs-agent`；缺省时行为与纯 mock 完全一致  | `deepseek/deepseek-chat`              |
| `MASTRA_MODEL_URL`     | 可选；OpenAI 兼容自定义端点，传入后 `model` 走 `{ id, url }` 对象形态  | `https://your-gateway.example.com/v1` |
| `MASTRA_MODEL_API_KEY` | 可选；自定义端点的 key（**url 场景必传**：Mastra url 场景不自动读 provider env） | `sk-xxx`                              |
| `MASTRA_MODEL_NAME`    | 可选；模型列表展示名，缺省 `Chat Agent`                                | `DeepSeek Agent`                      |
| `MASTRA_TOKEN`         | 可选；网关 Bearer，设置后 `/api/chat` 与 `/api/models` 需携带（`/health` 公开） | `s3cret`                              |
| `MASTRA_TELEMETRY`     | 可选；Studio 遥测开关                                                  | `true`                               |
| `CONTEXT7_API_KEY`     | 可选；docs-agent 的 context7 工具 key（stdio 启动 `npx @upstash/context7-mcp`，失败自动降级为不挂载） | `ctx7sk-xxx`                          |
| `DEV_SERVER_PORT`      | 可选；服务端口，缺省 `8787`                                            | `8787`                               |

模型 API Key 按 Mastra 路由约定的环境变量命名（如 `DEEPSEEK_API_KEY`），只放在 `packages/dev-server/.env`（不提交，参照 `.env.example`）。记忆落盘在 `file:.temp/dev-server.db`（相对 dev-server 包目录，启动时自动建目录），进程重启对话保留。API Key 缺失时 Mastra 直接抛明确错误（如 `Could not find API key process.env.DEEPSEEK_API_KEY`），以 `error` chunk 展示在前端，SSE 流仍完整可解析。

运行时注册（浏览器 `POST /api/providers` 即刻组装，`custom-{n}` 递增 id）与环境变量注册的差异见[服务端网关](/guide/server#运行时注册-vs-环境变量注册)。

## Studio 调试面板

[Mastra Studio](https://mastra.ai) 提供 agent 对话试验、trace 查看等调试能力。已并入 `pnpm dev` 一键全家桶（docs + dev-server + Studio）；只想要 Studio 时单独启动：

```bash
# 仓库根目录（需 packages/dev-server/.env 配置 MASTRA_MODEL，Studio 需要真实模型）
corepack pnpm dev:studio
```

Studio 读 `packages/dev-server/src/mastra/index.ts` 的**静态命名导出** `export const mastra`（mastra CLI 只认模块级静态导出，工厂函数或运行时赋值拿不到），从中加载全部 agent 定义。脚本内部是 `mastra dev -e .env`——**Studio UI 与 Mastra API 一体**，UI 默认 **4111 端口**、带 watch 热更新，与网关 8787 互不冲突；缺 `MASTRA_MODEL` 时启动抛可读错误。同款 CLI 还有 `mastra build` / `mastra start`（dev-server 包内 `pnpm build` / `pnpm start:mastra`），可把 agents 构建为独立部署产物。

Studio 只是**按需调试工具**（查看 agent 定义 / trace / playground 试验），不参与任何 dev 编排，日常开发不需要它。

## 流事件映射

适配层消费 Mastra 原生流 chunk（`{ type, payload }`）映射为 StreamChunk 线协议，前端组件自动展示：

| Mastra 流事件                              | StreamChunk                                              | 前端展示                                                           |
| ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `text-delta`                               | `text`                                                   | 正文流式渲染                                                       |
| `reasoning-delta`                          | `thinking`                                               | [ThinkingBlock](/components/message) 折叠思考块，done 时自动算耗时 |
| `tool-call-input-streaming-start` / `-end` | `tool_call` 双帧（起点帧带 id + name，结束帧带完整参数） | [ToolCall](/components/tool-call) 可折叠面板                       |
| `tool-result` / `tool-error`               | `tool_result`（`isError` 映射错误态）                    | ToolCall 面板的输出 / 错误区                                       |
| `error`                                    | `error` 后终止                                           | 消息内错误提示                                                     |
| `start` / `step-*` / `raw` / `source` 等   | 丢弃                                                     | ——                                                                 |

双帧 `tool_call` 由消费端按 `toolCallId` 原位合并——core 的 `useChat` 与网关 collector 均支持，最终只呈现一个工具条目（其他适配器发双帧同样受益）。网关保证以 `done` 帧收尾，出错时以 `error` chunk 收尾保持流可解析。

## 会话记忆

- 前端请求透传的 `conversationId` 自动映射为 Mastra 的 `memory.thread`：同一会话的上下文由 Agent 记忆补全
- 未传时每轮生成独立 thread（`mastra_thread_` 前缀），不跨轮记忆
- `resource`（默认 `'ai-chat'`）是 Mastra 记忆的命名空间，多用户场景可按用户区分
- 是否透传记忆由运行时探测（`agent.hasOwnMemory()`）：agent 定义未配置 `memory` 工厂时不会触发 Mastra 记忆装配
