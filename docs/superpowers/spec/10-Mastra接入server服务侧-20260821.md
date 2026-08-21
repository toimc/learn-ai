# Mastra 接入 server 服务侧需求规格

> 日期：2026-08-21 ｜ 状态：已批准（方案 A：适配器包装预构造 Agent + 声明式工厂）
> 范围声明：本期只做 Mastra 与 server 服务侧的集成骨架；**具体模型服务商与密钥配置是后续阶段**，本期以 env 门控 + 假工厂测试覆盖。

## 1. 背景与目标

第 15 章已落地 `@toimc/agents`（ModelRegistry + IModelAdapter）与 `@toimc/server`（Hono 网关）。前端线协议（`StreamChunk` 的 `tool_call`/`tool_result`/`thinking`）与 vue 包 ToolCall 组件族已完备，但服务端没有任何东西产出工具调用流（`ToolDefinition` 为占位符）。

本期目标：用 Mastra Agent 补上服务端 Agent 能力（工具调用 / 思考流映射 / 会话记忆 / 监控面板），接入点全部落在现有适配器架构上，registry / 网关 / 前端零改动。

### 已确认的关键事实（来自 Mastra 官方文档，2026-08）

- Mastra 模型层构建在 Vercel AI SDK 之上；`model` 字段支持 `"provider/model"` 字符串、`{ id, url }` 对象（自定义 OpenAI 兼容端点）、AI SDK provider 实例三种形态，密钥自动读环境变量
- `agent.stream(messages, options)` 的 messages 为 `[{ role, content }]`，与 `ChatMessage` 同构；支持 `abortSignal`、`memory: { thread, resource }`、`modelSettings: { temperature }`；**fullStream 直接产 Mastra 1.60 原生 chunk（`{ type, payload }` 形态）**，事件名为 `text-delta` / `reasoning-delta` / `tool-call-input-streaming-start` / `tool-call-delta` / `tool-call-input-streaming-end` / `tool-call` / `tool-result` / `tool-error`，无 `format: 'aisdk'` 选项
- `agent.generate()` 默认返回 Mastra 原生格式（含 `.text` / `.usage`）
- 工具用 `createTool({ id, inputSchema: z.object(...), execute })`，zod 依赖只进组装层
- `streamVNext` 是实验 API，**本期一律用稳定版 `stream()`**

## 2. 方案概述（方案 A）

```
packages/agents          ← 新增子路径导出 ./mastra（MastraAdapter + createMastraModel + 类型）
                           @mastra/core 声为 optional peerDependency（shiki/katex 同款模式）
packages/mock-server     ← 组装层：env 门控注册 Mastra 模型 + 示例工具 + Memory + Mastra 实例(telemetry)
packages/server / core / vue  ← 零改动
```

设计原则：**接口适配（稳定）进 agents 包，服务商配置（易变）留组装层**。

## 3. 功能需求

### FR1 `@toimc/agents/mastra` 子路径导出

- `MastraAdapter implements IModelAdapter`：构造时接收一个现成的 Mastra `Agent` 实例与可选 `MastraAdapterOptions`（`resource` 默认 `'ai-chat'`、`enableMemory` 等）
- 事件映射表（`chatStream` 消费 Mastra 1.60 原生 `fullStream` chunk，`{ type, payload }` 形态）：

| Mastra 1.60 原生事件 | StreamChunk |
|---|---|
| `text-delta` | `{ type: 'text', content }` |
| `reasoning-delta` | `{ type: 'thinking', content }` |
| `tool-call-input-streaming-start` | 发 `{ type: 'tool_call', metadata: { toolCallId, toolName } }`（起点帧，无参数）；`tool-call-delta` 累积参数 JSON 片段不发包；`tool-call-input-streaming-end` 发一帧 `tool_call`，`toolArguments` 为合并解析后的完整参数（拼不出合法对象退 `{ raw }`） |
| `tool-call`（未走流式分解的完整调用） | `tool_call` 带 `toolArguments`；与流式路径按 `toolCallId` 去重，避免双发 |
| `tool-result` | `{ type: 'tool_result', metadata: { toolCallId, toolName, toolResult 或 toolError } }`（`isError` 时映射错误态） |
| `tool-error` | `{ type: 'tool_result', metadata: { toolCallId, toolName, toolError } }` |
| `error` | `{ type: 'error', content }`，随后终止 |
| 流自然结束 | 依赖网关既有兜底补 `done` 帧（适配器自身不强制补） |

  > 实施偏差：@mastra/core 1.60 的 stream() 不支持 format:'aisdk'，fullStream 直接产 Mastra 原生 chunk；tool_result 无 duration 数据，字段不产出

- `chat(request)`：`agent.generate()` 取 `.text` / `.usage`（映射 promptTokens/completionTokens），组装 `ChatResponse`
- 记忆映射：`request.passthrough.conversationId`（网关已透传）→ `memory: { thread, resource }`；无 conversationId 时生成一次性 thread id（`generateId`）兜底——有 memory 的 Agent 缺 thread 会报错，无 memory 的 Agent 不传 memory 配置
  > 实施偏差：以 agent.hasOwnMemory() 探测代替 enableMemory 选项——探测是运行时事实，宿主无需重复声明（评审 I2）
- 中断：`request.signal` 直通 `abortSignal`；中断不算错误，不发 error chunk（对齐 openai-compat 语义）
- 依赖缺失：`@mastra/core` 未安装时子路径 import 报含安装命令的清晰错误

### FR2 `createMastraModel(config)` 声明式工厂

- 入参 `MastraModelConfig`：`{ id, name?, description?, model, instructions?, tools?, memory?, defaultResource? }`；`model` 类型 = Mastra 的 model 字段（字符串 / `{ id, url }` 对象 / AI SDK 实例）
- 返回 `{ adapter, info }`，直接喂 `registry.registerAdapter(id, adapter, info)`
- 工厂内部构造 `Agent` 并包成 `MastraAdapter`，宿主不接触 Mastra 类型也能用
  > 实施偏差（F1）：`createMastraModel` 为 **async**（返回 `Promise<MastraModel>`，调用方需 `await`）——Agent 构造器改为函数内动态 import 以在 `@mastra/core` 缺失时给出含安装指引的友好错误（FR1 依赖缺失条款）

### FR3 mock-server 组装层集成

- env 门控：`MASTRA_MODEL` 存在（如 `deepseek/deepseek-chat`，可选 `MASTRA_MODEL_URL` / `MASTRA_MODEL_NAME`）才注册第 4 个模型 `mastra-agent`；不存在时行为与现状完全一致（只有 3 个 mock）
- 示例工具 ×2（zod 只进 mock-server）：
  - `get_weather`：wttr.in 免费接口，`AbortSignal.timeout(5000)` 保护
  - `get_time`：本地时间，零网络依赖
- Memory：`Memory` + LibSQL `file:.temp/mastra.db`（`.temp/` 已 gitignore），`conversationId → thread`，进程重启对话保留
- 监控：`MASTRA_TELEMETRY=true` 时构造 `Mastra` 实例挂 agents + telemetry；文档写明 `npx mastra dev` 起 DevTools（默认 4111）查看；默认关闭

### FR4 文档同步

- `packages/docs/guide/server.md` 新增「Mastra Agent 接入」章节（装依赖 → createMastraModel → 注册 → 工具/记忆/DevTools）
- 项目 `README.md` 包依赖关系与能力描述更新
- 课程笔记 `notes/15/02、03` 的回写在实现合入后单独进行（不在本 spec 验收内，见 §7 后续）

## 4. 非功能需求

- **依赖纪律**：`@toimc/agents` 主入口（`.`）依赖树零新增；`@mastra/core`、`@mastra/memory`、`@mastra/libsql`、`zod` 只出现在：agents 的 `optional peerDependencies` + devDependencies（类型/构建），mock-server 的 dependencies
- **构建**：agents 的 vite 构建为 `./mastra` 增加独立 entry（ESM/CJS/d.ts 三格式对齐主入口）；tree-shaking 不回退（主入口产物体积不因 mastra 增长）
- **测试**：全部单元/集成测试不依赖网络与真实 API key；真实模型端到端验证留给后续服务商对接阶段
- **安全**：API key 只经环境变量进服务端内存，不进 `/api/models` 公开视图（复用 ModelRegistry 脱敏）、不进日志

## 5. 错误处理

- 上游模型缺 API key：Mastra 抛"指明缺哪个环境变量"的错误 → 映射为 error chunk → 前端展示
- 工具执行失败：`tool-output-error` → `tool_result` 带 `toolError`；Agent 循环自行决定重试/放弃
- 用户中断：`abortSignal` 直通，静默停止（无 error chunk），网关 onComplete 照常触发
- 流异常终止：网关既有"未发 done 兜底补帧"逻辑覆盖

## 6. 测试策略

- **MastraAdapter**：stub 假 Agent（脚本化事件序列），正常（纯文本/思考流）/边界（空流、中断、工具与文本交错、多工具）/异常（工具报错、error 事件）三类齐全；断言逐 chunk 形态与顺序
- **createMastraModel**：配置 → adapter/info 正确性；记忆配置传递
- **mock-server 门控**：无 env → 仍只有 3 个 mock；有 env（注入 fake factory）→ 注册第 4 个且模型列表含它
- **红灯先行 + 双盲**：测试由独立 subagent 仅凭本 spec §3 类型与映射表编写，禁止读实现源码；每条用例先在实现缺失/改错状态下见过红灯
- 覆盖率门禁沿用各包既有配置

## 7. 验收标准与后续

- [ ] `@toimc/agents/mastra` 子路径可 import，主入口产物无 mastra 代码
- [ ] `pnpm test` / `pnpm type-check` / `pnpm lint` 三绿（worktree 内先 build core/agents 出 dist）
- [ ] 无 env 时 mock-server 行为与现状完全一致（回归）
- [ ] 有 env 时（假工厂）注册 mastra-agent 模型，SSE 流映射符合 §3 表
- [ ] server.md / README 同步更新，docs-sync 门禁通过
- **后续阶段（不在本期）**：真实服务商（DeepSeek/GLM/Kimi）配置打通、`notes/15` 课程笔记回写、Mastra DevTools 实机验证
