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

本仓库 `packages/dev-server` 即 `createMastraGateway` 的完整示例（[Mock 服务端演示](/mock-server-demo)）：**env 门控、随装随卸**——`MASTRA_MODEL` 存在才注册 `chat-agent`、`docs-agent` 与 `orchestrator-agent` 三个 agent（`docs-agent` 是组件库助手，挂 `search_docs` 文档检索工具，配置 `EMBEDDING_MODEL` 后检索升级为「语义 + 关键词」混合，配置 `CONTEXT7_API_KEY` 后额外获得 context7 外部库文档查询工具；`orchestrator-agent` 是多 Agent 编排演示，经 `orchestrate` 工具调度检索员/起草员/审查员子 agent，支持委托/并行/流水线三种协作形态），缺省时是纯 mock 模式（零 mastra 依赖启动）。

`chat-agent` 的 `get_weather` 工具结果额外携带 `ui` 字段（`{ type: 'weather-card', props: { city, temperatureC, description } }`）——生成式 UI 的服务端半边：schema 由工具代码确定性生成（模型只决策不渲染），原始字段仍供模型生成回复，前端经 `tool_result` 帧拿到后可渲染天气卡片（组件注册表由 `@toimc/vue` 的 GenUI 能力提供）。

| 环境变量               | 说明                                                                   | 示例                                  |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `MASTRA_MODEL`         | 存在才注册 `chat-agent` / `docs-agent` / `orchestrator-agent`；缺省时行为与纯 mock 完全一致  | `deepseek/deepseek-chat`              |
| `MASTRA_MODEL_URL`     | 可选；OpenAI 兼容自定义端点，传入后 `model` 走 `{ id, url }` 对象形态  | `https://your-gateway.example.com/v1` |
| `MASTRA_MODEL_API_KEY` | 可选；自定义端点的 key（**url 场景必传**：Mastra url 场景不自动读 provider env） | `sk-xxx`                              |
| `MASTRA_MODEL_NAME`    | 可选；模型列表展示名，缺省 `Chat Agent`                                | `DeepSeek Agent`                      |
| `MASTRA_SUB_MODEL`     | 可选；检索等轻量角色的次级模型（orchestrator 的 researcher 子 agent 用它，演示"按角色选模型"） | `deepseek/deepseek-chat`              |
| `EMBEDDING_MODEL`      | 可选；存在即启用 `search_docs` 语义检索路（裸模型名走本地 Ollama，含 `provider/` 前缀走云端端点） | `bge-m3`                              |
| `EMBEDDING_MODEL_URL`  | 可选；embedding 的 OpenAI 兼容端点，缺省 `http://localhost:11434/v1`（本地 Ollama） | `http://localhost:11434/v1`           |
| `EMBEDDING_MODEL_API_KEY` | 可选；embedding 端点 key，本地 Ollama 缺省占位 `ollama`             | `sk-xxx`                              |
| `MASTRA_TOKEN`         | 可选；网关 Bearer，设置后 `/api/chat` 与 `/api/models` 需携带（`/health` 公开） | `s3cret`                              |
| `MASTRA_TELEMETRY`     | 可选；Studio 可观测性开关（traces/logs，默认开启，仅 `false` 显式关闭） | `false`                              |
| `CONTEXT7_API_KEY`     | 可选；docs-agent 的 context7 工具 key（stdio 启动 `npx @upstash/context7-mcp`，失败自动降级为不挂载） | `ctx7sk-xxx`                          |
| `DEV_SERVER_PORT`      | 可选；服务端口，缺省 `8787`                                            | `8787`                               |

浏览器打开服务根路径（如 `http://localhost:8787/`）是落地页：端点清单 + 上述 env 的实际生效状态（当前 LLM 是 mock 还是真实模型、检索是关键词还是混合），一眼确认配置是否按预期加载。

模型 API Key 按 Mastra 路由约定的环境变量命名（如 `DEEPSEEK_API_KEY`），只放在 `packages/dev-server/.env`（不提交，参照 `.env.example`）。记忆落盘在 `file:.temp/dev-server.db`（相对 dev-server 包目录，启动时自动建目录），进程重启对话保留。API Key 缺失时 Mastra 直接抛明确错误（如 `Could not find API key process.env.DEEPSEEK_API_KEY`），以 `error` chunk 展示在前端，SSE 流仍完整可解析。

### 语义检索：LibSQLVector + 本地 Ollama（RAG）

`search_docs` 默认是关键词检索（同义词表 + TF-IDF 加权）；配置 `EMBEDDING_MODEL` 后升级为「语义 + 关键词」混合检索（向量召回 + RRF 融合），口语化查询不再依赖同义词表硬扛。语料经 `MDocument` 切块、本地 Ollama `bge-m3` 嵌入后存入 `LibSQLVector`（`.temp/docs-vector.db`，与记忆分库——可随时重建的派生数据）：

```bash
# 一次性入库（文档变更或换 embedding 模型后重跑；查询时只 embed 查询文本）
cd packages/dev-server && pnpm index:docs
```

Ollama 未启动或索引缺失时自动降级回纯关键词检索，工具不崩。切块参数、探针定维、维度校验、混合融合与降级链的深读见[语义检索指南](/guide/rag)，可视化对比与向量库浏览见[向量检索演示](/vector-search-demo)。

### 可观测性：traces 与 logs（Studio 线）

Studio 线（`mastra dev`，4111）默认开启可观测性：agent 运行、工具调用、workflow step 自动产生 spans，`PinoLogger` 日志双写（控制台 + 观测库）并自动关联 trace/span ID，Studio 的 Observability 视图直接查看。存储为 composite 双域路由：会话域 LibSQL（`file:.temp/dev-server.db`，不动），观测域 DuckDB（`.temp/observability.duckdb`——LibSQL 观测域不支持日志落库，DuckDB 是官方本地推荐组合且提供 metrics 聚合，即 Studio 观测图表的数据源）。删掉 `.temp/observability.duckdb` 即可重置演示数据，不影响会话历史；span 输出经 `SensitiveDataFilter` 脱敏（passwords/tokens/keys）。`MASTRA_TELEMETRY=false` 显式关闭。注意：`@mastra/core` 锚 1.60，观测栈版本在 `pnpm-workspace.yaml` overrides 锁定（`@mastra/loggers@1.2.0`、`@mastra/observability@1.16.6`、`@mastra/duckdb@1.6.3`——更高版本依赖 core 1.63+ 的导出，会运行时崩溃）。

运行时注册（浏览器 `POST /api/providers` 即刻组装，`custom-{n}` 递增 id）与环境变量注册的差异见[服务端网关](/guide/server#运行时注册-vs-环境变量注册)。

### 宿主侧：把工具暴露为 MCP server

`CONTEXT7_API_KEY` 一节是**客户端方向**（我们连别人的 MCP server）；dev-server 同时内置了**宿主方向**——用 `@mastra/mcp` 的 `MCPServer` 把本地工具暴露给任意 MCP 客户端（Claude Code / MCP Inspector / 其他 agent 应用）：

```ts
// packages/dev-server/src/mcp/weather-server.ts
import { MCPServer } from '@mastra/mcp'
import { getWeatherTool } from '../tools/get-weather'

export const weatherMcpServer = new MCPServer({
  id: 'weather-mcp-server',
  name: 'ai-chat-ui Weather Server',
  version: '1.0.0',
  tools: { get_weather: getWeatherTool }, // 本地 Mastra 工具直传，schema 自动转换
})
```

两种消费形态：

- **stdio**（本地客户端拉起，已真机验证）：入口 `src/mcp/weather-stdio.ts` 调 `weatherMcpServer.startStdio()`。Claude Code 项目级 `.mcp.json`：

  ```json
  {
    "mcpServers": {
      "weather": {
        "command": "/bin/zsh",
        "args": ["-lc", "cd <仓库绝对路径>/packages/dev-server && corepack pnpm exec tsx src/mcp/weather-stdio.ts"]
      }
    }
  }
  ```

  连上后 `tools/list` 可见 `get_weather(city)`，调用走 wttr.in 真实返回。
- **注册进 Mastra 实例**：`src/mastra/index.ts` 的 `new Mastra({ mcpServers: { [WEATHER_MCP_SERVER_ID]: weatherMcpServer } })`，`listMCPServers()` 可查。当前 `mastra` CLI 1.26 的 dev server 尚不自动暴露 HTTP 端点（其 `/mcp/v0/*` 路由是 MCP Registry 目录 API），升级 CLI 后此注册即自动获得端点——这也是把注册写进实例的理由。

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

记忆落盘、路径锚定与 composite 双域的深读见[会话记忆指南](/guide/memory)。
