---
layout: MockApiPage
title: 接口文档
---

接口文档由 [Scalar](https://scalar.com) 渲染，规范来自 dev-server 的 `GET /api/openapi.json`（OpenAPI 3.1）。dev-server 本身基于 `@toimc/server` 网关组装，线协议与[服务端网关](/guide/server)完全一致——想在自己的后端复刻这套接口，直接用 `createChatGateway` 即可。

- **左侧**：全部 mock 接口，按「会话 / 对话 / Provider / 认证 / 工作流 / 元信息 / 向量检索」分组
- **右侧**：接口详情（参数、请求体、响应 schema 与示例）
- **Test Request**：可直接在页面执行请求，响应实时展示（服务端已开 CORS）；`POST /api/chat` 会以 `text/event-stream` 返回，Scalar 展示累积后的完整 SSE 文本，想看逐块流式效果请前往 [Mock 服务端演示](/mock-server-demo)

需要 dev-server 在线：项目根目录运行 `pnpm dev`（文档站与 dev 服务同时启动）。规范源码位于 `packages/dev-server/src/openapi.ts`，与路由实现同包维护。

`POST /api/chat` 的 user 消息 `content` 支持多模态 parts 数组（`text` + `image_url`，OpenAI 兼容形态，示例见端点详情的「多模态」请求示例）：mock 剧本提取文字部分匹配（图片忽略，行为可预期），配置 `MASTRA_MODEL` 后透传给多模态模型。完整说明见[服务端网关](/guide/server#多模态消息-content-parts)。

## 向量检索端点

「向量检索」分组三个端点是 docs-agent 语义检索的运维与调试面，前端消费见[向量检索演示](/vector-search-demo)，原理深读见[语义检索指南](/guide/rag)：

| 端点 | 用途 |
|---|---|
| `GET /api/vector/stats` | 索引状态：embedding 配置 / 引擎与库文件（`vector.engine/location`）/ 块数 / 维度 |
| `POST /api/vector/search` | 同一查询双路对比（关键词基线 vs 混合实况），响应含 `timing`（keywordMs / vectorMs）与 `degradedReason` |
| `GET /api/vector/chunks` | 向量库浏览：分页列出全部语义块，`source` 按文档过滤、`q` 对块文本 LIKE 过滤 |

## 认证端点（AUTH_MODE=user）

「认证」分组四端点是用户体系（多用户 / 配额 / thread 隔离）的 HTTP 面，环境变量配置见[服务端网关](/guide/server)，仅在 dev-server 配置 `AUTH_MODE=user`（与 `AUTH_JWT_SECRET`）时挂载，默认 `static` 模式下 404：

| 端点 | 用途 |
|---|---|
| `POST /api/auth/register` | 注册（邮箱 + 密码，8-128 字符），201 即登录态直接返回 access token；409 邮箱占用 / 429 IP 限流（每小时 5 次） |
| `POST /api/auth/login` | 登录签发 15 分钟 JWT；401 一律「邮箱或密码错误」不泄漏哪个字段错 |
| `POST /api/auth/keys` | 签发 API Key（`sk-aichat-` 前缀，明文只出现一次）；只认 JWT——API Key 不能繁殖 key |
| `DELETE /api/auth/keys/:keyId` | 撤销自己的 API Key，下一秒全端点生效 |

user 模式下 `POST /api/chat` 与 `GET /api/models` 要求 `Authorization: Bearer <JWT|API Key>`，并叠加每用户每日配额（free 20 / pro 200，超额 **402** `QUOTA_EXCEEDED` + `upgradeUrl`）与 thread 归属隔离（他人会话 **403** `THREAD_FORBIDDEN`）。

## 工作流端点

「工作流」分组两端点是多 Agent 协作编排的运行面（需配置 `MASTRA_MODEL`，纯 mock 模式 `GET` 返回空列表）：`GET /api/workflows` 列出可用工作流；`POST /api/workflows/:id/run` 以 `POST /api/chat` 同款 SSE 线协议逐帧输出（前端零改动复用渲染）。

## Provider 运行时注册

`/api/providers` 三端点把浏览器表单提交的模型配置注册为带工具（get_time / get_weather）与会话记忆的 Mastra Agent 模型，注册成功即出现在 `GET /api/models`，`POST /api/chat` 传对应 `model` 即可使用。前端体验见 [Playground](/playground)，服务端两条注册路径的对比见[服务端网关](/guide/server#运行时注册-vs-环境变量注册)。

### POST /api/providers

注册一个运行时 Provider。请求体（`ProviderFormPayload`）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | `string` | 是 | 展示名 |
| provider | `'openai-compat' \| 'anthropic'` | 是 | 协议类型 |
| baseURL | `string` | openai-compat 必填 | anthropic 缺省走官方端点 |
| apiKey | `string` | 是 | 密钥，仅服务端内存持有 |
| model | `string` | 是 | 模型名，如 `deepseek-chat` / `claude-sonnet-4-5` |

```json
{
  "name": "DeepSeek",
  "provider": "openai-compat",
  "baseURL": "https://api.deepseek.com/v1",
  "apiKey": "sk-your-api-key",
  "model": "deepseek-chat"
}
```

- 校验失败返回 **400** `{ "error": "..." }`（如 `apiKey is required`、`baseURL is required for openai-compat`）
- 成功返回 **201** + 脱敏的 `ProviderOption`；id 由服务端生成，规则 `custom-{n}` 递增（进程内存计数，重启归零）
- 注册不做上游连通性校验（惰性），首次对话才真连上游，失败走既有 `error` chunk
- **apiKey 只进服务端内存：不落盘、不进日志、不进任何 GET 响应**

### GET /api/providers

返回运行时注册项列表（**仅**运行时经 POST 注册的模型，不含环境变量注册的 `chat-agent`，绝不含 apiKey）：

```json
{
  "providers": [
    { "id": "custom-1", "name": "DeepSeek", "provider": "openai-compat", "model": "deepseek-chat" }
  ]
}
```

### DELETE /api/providers/:id

从 registry 与运行时列表中移除指定 `custom-{n}` 模型：成功返回 **200** `{ "ok": true }`；id 不存在返回 **404**。删除后历史会话再发送，网关按既有错误路径返回 `error` chunk。
