---
'@toimc/agents': minor
---

新增 `@toimc/agents/mastra` 可选子路径：MastraAdapter 把 Mastra Agent 流映射为 StreamChunk 线协议（工具调用/思考流），createMastraModel 声明式工厂（async，`@mastra/core` 缺失时抛含安装指引的友好错误）；@mastra/core 声为 optional peerDependency（`^1.60.0`）
