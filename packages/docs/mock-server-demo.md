---
layout: MockServerDemoPage
title: Mock 服务端演示
---

本页连接本地 dev-server（`@toimc/dev-server`，Hono + `streamSSE`）：

- **多会话切换**：左侧会话列表来自 `GET /api/conversations`，每次切换从服务端拉取该会话历史（`GET /api/conversations/:id/messages`），发送过的新消息也会写回服务端内存，切走再切回不丢失。
- **真实 SSE 流式**：发送消息走 `POST /api/chat`，响应为 `text/event-stream`，浏览器 DevTools 的 Network 面板可以看到逐块到达的 chunk 帧（与 `@toimc/core` 的 `StreamChunk` 同构）。
- **场景触发词**：输入区工具栏内置 `思考` / `工具 天气` / `错误` / `慢速` / `markdown` 快捷按钮（点击即发送），分别触发思维链、工具调用、流中断、慢速输出与富文本剧本；回复以 **token 粒度逐字流式输出**（每块 4 字符、约 45ms 间隔）。
- **服务未启动时**：顶部状态指示灯变红并给出启动提示，`pnpm dev` 会同时启动文档站与 dev-server。
- **自适应高度**：聊天区域占满视口剩余高度（矮窗口下限 480px），消息在区域内滚动，输入框始终可见。

完整交互式 Playground（本地 mock 数据版）见 [Playground](/playground)；接口清单与在线执行见 [接口文档](/mock-api)。

## 线协议格式

SSE 响应为 `text/event-stream`，每帧格式：

```
event: chunk
data: {"type":"text","content":"你好"}
```

剧本收尾的 done 帧携带模拟 usage（与真实 provider 的 usage 透传同构），供前端做上下文窗口的真实 token 校准：

```
event: chunk
data: {"type":"done","content":"","metadata":{"usage":{"inputTokens":42,"outputTokens":18}}}
```
