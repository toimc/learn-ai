# Mastra 智能体

[服务端网关](/guide/server)的各 provider 都是纯模型转发——收消息、调模型、回流。当应用需要**工具调用、会话记忆**这类 Agent 能力时，接入 [Mastra](https://mastra.ai)：`@toimc/agents/mastra` 子路径把 Mastra `Agent` 包装成标准 `IModelAdapter`，注册进网关后前端组件照常消费 StreamChunk，不感知后端是裸模型还是 Agent。

```text
浏览器 → @toimc/vue 组件 → ChatAdapter（fetch SSE）
       → @toimc/server 网关（鉴权/限流/协议归一）
       → @toimc/agents/mastra（MastraAdapter 事件映射）
       → Mastra Agent（工具调用 ReAct 循环 + 会话记忆）
       → 上游大模型 API
```

## 安装

`@mastra/core` 是 `@toimc/agents` 的**可选 peer 依赖**：不用 mastra 子路径就不需要安装，主入口（`@toimc/agents`）完全不受影响；用到子路径时才装。未安装时 `@toimc/agents/mastra` 模块本身仍可正常加载，只有调用 `createMastraModel` 构造 Agent 时才会抛出含安装指引（`pnpm add @mastra/core`）的友好错误。

```bash
pnpm add @toimc/agents @mastra/core @mastra/memory @mastra/libsql zod
```

`@mastra/memory` + `@mastra/libsql` 用于会话记忆落盘（不需要记忆可省去），`zod` 用于工具入参 schema。仓库按 `@mastra/core ^1.60.0` 验证（peer 范围 `^1.60.0`）。

## 注册 Agent 模型

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

## 流事件映射

适配器消费 Mastra 原生流 chunk（`{ type, payload }`）映射为 StreamChunk 线协议，前端组件自动展示：

| Mastra 流事件 | StreamChunk | 前端展示 |
| --- | --- | --- |
| `text-delta` | `text` | 正文流式渲染 |
| `reasoning-delta` | `thinking` | [ThinkingBlock](/components/message) 折叠思考块，done 时自动算耗时 |
| `tool-call-input-streaming-start` / `-end` | `tool_call` 双帧（起点帧带 id + name，结束帧带完整参数） | [ToolCall](/components/tool-call) 可折叠面板 |
| `tool-result` / `tool-error` | `tool_result`（`isError` 映射错误态） | ToolCall 面板的输出 / 错误区 |
| `error` | `error` 后终止 | 消息内错误提示 |

双帧 `tool_call` 由消费端按 `toolCallId` 原位合并——core 的 `useChat` 与网关 collector 均支持，最终只呈现一个工具条目（其他适配器发双帧同样受益）。

## 会话记忆

- 前端请求透传的 `conversationId` 自动映射为 Mastra 的 `memory.thread`：同一会话的上下文由 Agent 记忆补全
- 未传时每轮生成独立 thread（`mastra_thread_` 前缀），不跨轮记忆
- `resource`（默认 `'ai-chat'`）是 Mastra 记忆的命名空间，多用户场景可按用户区分
- 是否透传记忆由运行时探测（`agent.hasOwnMemory()`）：`createMastraModel` 未配置 `memory` 时不会触发 Mastra 记忆装配

## mock-server 环境变量

本仓库 mock-server 即此接入的完整示例（[mock 服务演示](/mock-server-demo)），env 门控、随装随卸：

| 环境变量 | 说明 | 示例 |
| --- | --- | --- |
| `MASTRA_MODEL` | 存在才注册 `mastra-agent` 模型；缺省时行为与纯 mock 完全一致 | `deepseek/deepseek-chat` |
| `MASTRA_MODEL_URL` | 可选；OpenAI 兼容自定义端点，传入后 `model` 走 `{ id, url }` 对象形态 | `https://your-gateway.example.com/v1` |
| `MASTRA_MODEL_NAME` | 可选；模型列表展示名，缺省 `Mastra Agent` | `DeepSeek Agent` |
| `MASTRA_TELEMETRY` | `true` 时构造 `Mastra` 实例并开 telemetry，配合 `npx mastra dev` 起 Studio 监控面板（默认 4111 端口） | `true` |

记忆落盘在 `file:.temp/mastra.db`（相对 mock-server 包目录，启动时自动建目录），进程重启对话保留。API Key 缺失时 Mastra 直接抛明确错误（如 `Could not find API key process.env.DEEPSEEK_API_KEY`），以 `error` chunk 展示在前端，SSE 流仍完整可解析。
