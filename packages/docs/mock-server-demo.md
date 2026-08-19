---
layout: MockServerDemoPage
title: Mock 服务端演示
---

本页连接本地 mock-server（`@ai-chat/mock-server`，Hono + `streamSSE`）：

- **多会话切换**：左侧会话列表来自 `GET /api/conversations`，每次切换从服务端拉取该会话历史（`GET /api/conversations/:id/messages`），发送过的新消息也会写回服务端内存，切走再切回不丢失。
- **真实 SSE 流式**：发送消息走 `POST /api/chat`，响应为 `text/event-stream`，浏览器 DevTools 的 Network 面板可以看到逐块到达的 chunk 帧（与 `@ai-chat/core` 的 `StreamChunk` 同构）。
- **场景触发词**：`思考` / `工具 天气` / `错误` / `慢速` / `markdown` 分别触发思维链、工具调用、流中断、慢速输出与富文本剧本。
- **服务未启动时**：顶部状态指示灯变红并给出启动提示，`pnpm dev` 会同时启动文档站与 mock-server。

完整交互式 Playground（本地 mock 数据版）见 [Playground](/playground)。
