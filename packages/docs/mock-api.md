---
layout: MockApiPage
title: 接口文档
---

接口文档由 [Scalar](https://scalar.com) 渲染，规范来自 mock-server 的 `GET /api/openapi.json`（OpenAPI 3.1）。

- **左侧**：全部 mock 接口，按「会话 / 对话 / 元信息」分组
- **右侧**：接口详情（参数、请求体、响应 schema 与示例）
- **Test Request**：可直接在页面执行请求，响应实时展示（服务端已开 CORS）；`POST /api/chat` 会以 `text/event-stream` 返回，Scalar 展示累积后的完整 SSE 文本，想看逐块流式效果请前往 [Mock 服务端演示](/mock-server-demo)

需要 mock-server 在线：项目根目录运行 `pnpm dev`（文档站与 mock 服务同时启动）。规范源码位于 `packages/mock-server/src/openapi.ts`，与路由实现同包维护。
