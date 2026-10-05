---
layout: MockApiPage
title: 接口文档
---

接口文档由 [Scalar](https://scalar.com) 渲染，规范来自 dev-server 的 `GET /api/openapi.json`（OpenAPI 3.1）。dev-server 本身基于 `@toimc/server` 网关组装，线协议与[服务端网关](/guide/server)完全一致——想在自己的后端复刻这套接口，直接用 `createChatGateway` 即可。

- **左侧**：全部 mock 接口，按「会话 / 对话 / Provider / 元信息 / 向量检索」分组
- **右侧**：接口详情（参数、请求体、响应 schema 与示例）
- **Test Request**：可直接在页面执行请求，响应实时展示（服务端已开 CORS）；`POST /api/chat` 会以 `text/event-stream` 返回，Scalar 展示累积后的完整 SSE 文本，想看逐块流式效果请前往 [Mock 服务端演示](/mock-server-demo)

需要 dev-server 在线：项目根目录运行 `pnpm dev`（文档站与 dev 服务同时启动）。规范源码位于 `packages/dev-server/src/openapi.ts`，与路由实现同包维护。

`POST /api/chat` 的 user 消息 `content` 支持多模态 parts 数组（`text` + `image_url`，OpenAI 兼容形态，示例见端点详情的「多模态」请求示例）：mock 剧本提取文字部分匹配（图片忽略，行为可预期），配置 `MASTRA_MODEL` 后透传给多模态模型。完整说明见[服务端网关](/guide/server#多模态消息-content-parts)。

## 向量检索端点

「向量检索」分组三个端点是 docs-agent 语义检索的运维与调试面，前端消费见[向量检索演示](/vector-search-demo)，原理深读见[语义检索指南](/guide/rag)：

| 端点 | 用途 |
|---|---|
| `GET /vector/stats` | 索引状态：embedding 配置 / 引擎与库文件（`vector.engine/location`）/ 块数 / 维度 |
| `POST /vector/search` | 同一查询双路对比（关键词基线 vs 混合实况），响应含 `timing`（keywordMs / vectorMs）与 `degradedReason` |
| `GET /vector/chunks` | 向量库浏览：分页列出全部语义块，`source` 按文档过滤、`q` 对块文本 LIKE 过滤 |

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
