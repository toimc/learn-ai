# @toimc/agents

## 0.2.0

### Minor Changes

- cd470f7: 新增 `@toimc/agents/mastra` 可选子路径：MastraAdapter 把 Mastra Agent 流映射为 StreamChunk 线协议（工具调用/思考流），createMastraModel 声明式工厂（async，`@mastra/core` 缺失时抛含安装指引的友好错误）；@mastra/core 声为 optional peerDependency（`^1.60.0`）

### Patch Changes

- Updated dependencies [c25f7b2]
  - @toimc/core@0.0.2

## 0.1.0

### Minor Changes

- cc5746f: 首发服务端双包：

  - **@toimc/agents**：模型适配层。`IModelAdapter` 统一接口 + `ModelRegistry` 注册中心（公开视图自动脱敏），内置 OpenAI 兼容协议（OpenAI/DeepSeek/GLM/Kimi/OpenRouter 等，reasoning 输出映射 thinking）与 Anthropic 原生协议适配器，通用 SSE 字节流解析。零外部依赖（原生 fetch），可脱离网关单独使用。
  - **@toimc/server**：Hono 聊天网关。`createChatGateway()` 一站式工厂 + 底层路由/中间件双导出；`POST /api/chat` SSE 流式输出 `StreamChunk`（与前端 sse-adapter 线协议一致），Bearer 认证 / 内存限流 / CORS（默认反射 Origin）/ 日志四层中间件按需启用，`onComplete` 流收尾钩子支持持久化。fetch 风格导出，兼容 Node / Bun / Deno / Vercel 多运行时。
