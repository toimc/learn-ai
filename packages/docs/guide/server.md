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

## 智能体接入（@toimc/server/mastra）

上文各 provider 都是纯模型转发。需要**工具调用、会话记忆**这类 Agent 能力时，用可选子路径 `@toimc/server/mastra`：`createMastraGateway` 接收 agent 定义列表（`MastraAgentDefinition`，纯配置对象），逐个构建注册进**同一个网关**，`models` 之外的网关选项（auth / rateLimit / onComplete）原样透传：

```ts
import { createMastraGateway } from '@toimc/server/mastra'

const { app, registry } = await createMastraGateway({
  models: [{ id: 'mock-pro', provider: 'openai-compat', model: 'mock', apiKey: 'unused' }],
  agents: [
    {
      id: 'chat-agent', // 网关模型 id，GET /api/models 可见
      name: 'Chat Agent',
      model: 'deepseek/deepseek-chat', // 或 { id, url, apiKey? } 自定义端点
      instructions: '你是演示 Agent…',
      tools: { getTimeTool, getWeatherTool }, // createTool 产物字典
      memory: createMemory, // Memory 实例工厂（惰性）；不传则无记忆
    },
  ],
})
```

agent 构建失败（`@mastra/core` 未装、模型配置非法）时整体抛含 agent id 的可读错误——启动即失败优于静默降级。`@mastra/core` 是该子路径的可选 peer，主入口零新增依赖。完整指南（安装、env、Studio）见[智能体接入](/guide/mastra)；不想引入 `@toimc/server` 时，`@toimc/agents/mastra` 子路径的 `createMastraModel` 也把 Mastra `Agent` 包装成标准 `IModelAdapter`，注册方式与上文自定义适配器一致。

### 运行时注册 vs 环境变量注册

`MASTRA_MODEL` 是**启动时**经环境变量注册（id 固定 `chat-agent`）；dev-server 还提供**运行时**注册：浏览器把表单配置 `POST /api/providers` 上来，服务端即刻组装注册（id 递增 `custom-{n}`；`PUT /api/providers/:id` 原位更新沿用原 id）。两条路径写进**同一个 registry**，并存不冲突，`GET /api/models` 里都可见：

|          | 环境变量注册                               | 运行时注册（API）                                                           |
| -------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| 触发时机 | 进程启动（`readDevServerEnv` 探测）        | 请求到达（`POST` 创建 / `PUT` 原位更新）                                    |
| 模型 id  | `chat-agent`                               | `custom-{n}` 递增（注册表落盘 `.temp/providers.json`，git 忽略；重启经 `restore()` 恢复且 id 沿用、自增序号抬高防撞） |
| 配置来源 | `MASTRA_MODEL` / `MASTRA_MODEL_URL` 等 env | 请求体（`ProviderFormPayload`：name / provider / baseURL / apiKey / model） |
| 密钥去向 | 环境变量                                   | 服务端内存 + `.temp/providers.json` 本地落盘（git 忽略）：不进日志、`GET /api/providers` 只回脱敏视图（不含 key，`baseURL` 供编辑预填） |
| 注销     | 无（进程级）                               | `DELETE /api/providers/:id`                                                 |

组装逻辑在 `registerRuntimeProvider`（`packages/dev-server/src/routes/providers.ts`），按协议类型走 `createMastraModel` 的两种 `model` 形态：

```ts
// openai-compat：{ id, url, apiKey } 对象（OpenAI 兼容自定义端点）
model: { id: payload.model, url: payload.baseURL, apiKey: payload.apiKey }

// anthropic：'anthropic/{model}' 路由串，注册前把密钥注入 env（Mastra 官方路由从 env 取）
process.env.ANTHROPIC_API_KEY = payload.apiKey
model: `anthropic/${payload.model}`
```

两条路径注册的模型都自动挂上 `get_time` / `get_weather` 两个演示工具与同一个 LibSQL 记忆（`file:.temp/dev-server.db`），因此运行时注册的模型天然支持工具调用与会话记忆。注册**不做上游连通性校验**（惰性连接）：首次对话才真连上游，密钥错误 / 端点不通等失败按既有路径以 `error` chunk 呈现，SSE 流仍完整可解析。

四端点契约（POST 校验失败 400、成功 201，PUT / DELETE 目标不存在 404，GET 响应脱敏）见[接口文档](/mock-api#provider-运行时注册)；前端表单组件见 [ProviderSettingsDialog](/components/provider-settings-dialog)，端到端体验在 [Playground](/playground)。

## 中间件选项

网关默认只开 CORS；鉴权与限流按需启用，均可单独 import 底层件挂到自己的 Hono 应用：

```ts
createChatGateway({
  models,
  basePath: '/api', // 路由前缀，默认 '/api'
  cors: true, // 默认开
  logging: true, // hono/logger 请求日志，默认关
  auth: { tokens: [process.env.GATEWAY_TOKEN!] }, // 静态 Bearer 白名单，默认关（/health 不受影响）
  identity: { store, jwtSecret }, // 用户态认证与治理（见下节），默认关
  rateLimit: { windowMs: 60_000, max: 30 }, // 内存限流，默认关
  defaultModel: 'gpt-5-mini', // 请求不带 model 时的缺省
})
```

## 多用户：认证与配额（identity 模式）

静态 `auth.tokens` 白名单解决"谁能连"，用户态 `identity` 解决"陌生人能不能安全地用"：注册登录、API Key 签发、每日配额、会话隔离、用量记账五件套，`userId` 贯穿认证 → 配额 → 隔离 → 记账四站。

```ts
import { createChatGateway } from '@toimc/server'

const app = createChatGateway({
  models,
  identity: {
    store,                       // IdentityStore 端口实现（见下）
    jwtSecret: process.env.AUTH_JWT_SECRET!,
    freeDailyQuota: 20,          // 免费用户每日对话数，默认 20
    proDailyQuota: 200,          // pro 用户，默认 200
    accessTokenTtlSeconds: 900,  // access token 有效期，默认 15 分钟
  },
})
```

### IdentityStore 端口与表结构

网关不绑数据库：`identity.store` 是 `IdentityStore` 接口（`createUser / findUserByEmail / insertApiKey / claimThread / incrDailyUsage / insertUsage / listUsage` 等方法）。dev-server 提供 LibSQL 文件库实现（`@libsql/client`，库文件 `.temp/auth.db`），五张表：

```sql
users(id, email UNIQUE, password_hash, plan('free'|'pro'), created_at)
api_keys(id, user_id, key_hash UNIQUE, key_prefix, status('active'|'revoked'), created_at)
  -- key_hash 存 SHA-256：库里永远没有明文 key；key_prefix 存前 16 字符供后台展示「sk-aichat-ab12…」
thread_owners(thread_id PK, user_id, created_at)          -- conversationId 首次使用即归属
daily_usage(user_id, day, count, PK(user_id, day))        -- 配额计数：重启不清零
usage_log(id, user_id, model, input_tokens, output_tokens, estimated, cost_usd, created_at)
```

密码用 `node:crypto` 的 scrypt 慢哈希（标准库、免原生依赖），存储格式 `scrypt:<salt>:<derived>`。

### 认证路由（挂 basePath 下 /auth）

| 端点 | 鉴权 | 请求 | 成功响应 |
| --- | --- | --- | --- |
| `POST /api/auth/register` | 无（IP 限流 5 次/小时） | `{email, password}`（密码 8-128 字符） | `201 {userId, email, accessToken, expiresIn}`；重复邮箱 `409` |
| `POST /api/auth/login` | 无 | `{email, password}` | `200 {userId, email, accessToken, expiresIn}`；失败一律 `401 {error:'邮箱或密码错误'}` |
| `POST /api/auth/keys` | Bearer JWT | —— | `201 {keyId, key, keyPrefix}`，明文 key **只此一次** |
| `DELETE /api/auth/keys/:keyId` | Bearer JWT | —— | `204`；不存在或不属于本人 `404` |

access token 是 HS256 JWT（`sub=userId`），默认 15 分钟过期；注册接口自带 IP 限流（防批量注册）。业务端点（`/api/chat`、`/api/models`）同时接受 **API Key**（`sk-aichat-` 前缀，面向程序）与 **JWT**（面向人）；key 管理只认 JWT——API Key 不应能繁殖 key。

### 每日配额：超额 402，引导付费而非报错

配额中间件挂在识别之后：原子自增当日计数（UTC 自然日，跨日翻页重置），超过 plan 配额返回 **402**（该付费了）而非 429：

```json
// 402 响应体
{
  "error": "今日免费额度已用完，明日重置或升级套餐",
  "code": "QUOTA_EXCEEDED",
  "quota": 20,
  "upgradeUrl": "/pricing"
}
```

响应头带 `retry-after`（距下一个 UTC 日零点的秒数）。前端收到 402 不弹红色错误，而是渲染升级卡片——超额是转化时机，不是故障。计数持久化在存储里，**服务重启当日已用次数不归零**。

### 会话隔离：thread 归属与 resource 覆写

`conversationId`（即 mastra 的 thread）首次使用即登记归属（`thread_owners` 表）：**本人复用放行，他人冒用返回 `403 {error:'Forbidden thread', code:'THREAD_FORBIDDEN'}`**——IDOR 防线，客户端传什么都改变不了归属。

`userId` 由服务端在认证后注入请求体的 `body.userId`（客户端传入的同名字段一律丢弃覆写），随 `passthrough` 流向适配器。mastra agent 定义把 `resource` 写成函数即可实现按用户隔离的记忆命名空间：

```ts
const agents = [{
  id: 'chat-agent',
  model: 'deepseek/deepseek-chat',
  memory: createMemory,
  // resource 归属只信服务端注入的 userId
  resource: (p) => (p.userId ? `user:${p.userId}` : 'ai-chat'),
}]
```

### 用量记账：onComplete 里落 usage_log

适配器在流收尾的 `done` 帧 `metadata.usage` 回传真实 token 用量（`{inputTokens, outputTokens}`；mock 与 mastra 适配器均已实现），网关累积进 `ChatCompletionResult.usage`：

```ts
createChatGateway({
  models,
  chat: {
    onComplete(result) {
      // result.usage: { inputTokens, outputTokens } | undefined
      // undefined 时可按 core 的 estimateTokens 估算兜底（dev-server 即如此，标记 estimated=true）
      await store.insertUsage({
        userId: result.body.userId!,
        model: result.model,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        estimated: !result.usage,
        createdAt: new Date().toISOString(),
      })
    },
  },
})
```

`usage_log` 是后续计费、熔断、成本报表的唯一数据源；`cost_usd` 列已预留（成本熔断与 prompt caching 为后续计划）。

### dev-server 环境变量

dev-server（8787 演示服务）用 env 门控用户态，缺省全部保持现状：

| env | 作用 | 默认 |
| --- | --- | --- |
| `AUTH_MODE` | `static`（现状白名单）/ `user`（用户态） | `static` |
| `AUTH_JWT_SECRET` | JWT 签发密钥（user 模式必填，缺省启动报错） | —— |
| `AUTH_DAILY_QUOTA_FREE` / `AUTH_DAILY_QUOTA_PRO` | 每日配额 | `20` / `200` |
| `AUTH_DB_URL` | 身份库文件 URL | `.temp/auth.db` |

## 流收尾钩子 onComplete

流式过程中网关按 chunk 类型累积出完整的助手消息（text 拼接、thinking 归集、tool_call/tool_result 自动配对），流结束（含客户端中止）回调，适合落库或审计：

```ts
createChatGateway({
  models,
  chat: {
    onComplete(result) {
      // result.body        原始请求体（conversationId 等透传字段在内；identity 模式含服务端注入的 userId）
      // result.model       本轮使用的模型 id
      // result.assistant   { id, content, thinking?, toolCalls?, createdAt }
      // result.usage       适配器 done 帧回传的真实 token 用量 {inputTokens, outputTokens}，未回传为 undefined
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
