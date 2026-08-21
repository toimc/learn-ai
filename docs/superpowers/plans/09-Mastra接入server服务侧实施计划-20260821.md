# Mastra 接入 server 服务侧实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@toimc/agents` 增加 `./mastra` 子路径导出（MastraAdapter + createMastraModel），mock-server env 门控接入 Mastra Agent（工具/记忆/telemetry），网关与前端零改动。

**Architecture:** 方案 A——适配器包装预构造 Agent。接口适配（稳定）进 agents 包 `./mastra` 子路径（`@mastra/core` 为 optional peerDependency，shiki/katex 同款模式）；服务商配置（易变）留 mock-server 组装层。事件映射：Mastra AI SDK v5 流事件 → `StreamChunk` 线协议。

**Tech Stack:** Mastra `@mastra/core`（Agent）+ `@mastra/memory` + `@mastra/libsql`（Memory 存储）+ zod（工具 schema，仅组装层）+ Vitest。

**规格文档:** `docs/superpowers/spec/10-Mastra接入server服务侧-20260821.md`

**Worktree:** `.claude/worktrees/feat-mastra-agent`（分支 `feat/mastra-agent-integration`，基于 dev）。所有命令在此 worktree 根目录执行。

**重要约束（所有任务通用）:**
- 用 `corepack pnpm <cmd>`（裸 pnpm 被 asdf 拦截）
- type-check 前必须先 `corepack pnpm --filter @toimc/core --filter @toimc/agents build`（type-check 读 dist）
- 提交信息：中文 Conventional Commits，scope 用 agents/mock-server/docs
- 测试纪律：红灯先行（每条新测试先在实现缺失/改错状态见过 FAIL）、测试预期值写手写字面量
- 已确认的 Mastra API 事实（写死，不要另查）：
  - `new Agent({ id, name, instructions, model, tools?, memory? })`，`model` 接受 `'provider/model'` 字符串 / `{ id, url }` 对象 / AI SDK 实例
  - `agent.stream(messages, { abortSignal, memory: { thread, resource }, temperature, format: 'aisdk' })` 返回含 `fullStream` 的流对象；messages 为 `[{ role, content }]`
  - `agent.generate(messages, options)` 返回含 `.text` / `.usage`（`usage.aiSdk.inputTokens/outputTokens` 或 `usage.promptTokens/completionTokens`，以实际安装版本类型为准，测试里用 stub 不依赖真形状）
  - `createTool({ id, description, inputSchema: z.object(...), execute })` 自 `@mastra/core/tools`
  - `Memory` 自 `@mastra/memory`，`LibSQLStore` 自 `@mastra/libsql`

---

### Task 1: 依赖安装与 agents 包构建脚手架

**Files:**
- Modify: `packages/agents/package.json`
- Modify: `packages/agents/vite.config.ts`
- Modify: `packages/mock-server/package.json`（依赖由 pnpm 自动写入）

- [ ] **Step 1: 安装依赖**

```bash
corepack pnpm add @mastra/core@latest
corepack pnpm --filter @toimc/mock-server add @mastra/core@latest @mastra/memory@latest @mastra/libsql@latest zod@latest
```

说明：在 worktree 根执行。agents 包装 `@mastra/core`（devDep 语义，构建与类型用），mock-server 装全部运行时依赖。

- [ ] **Step 2: 改造 agents/package.json**

`peerDependencies` 增加（optional 标注）、`exports` 增加 `./mastra` 子路径：

```json
{
  "peerDependencies": {
    "@mastra/core": ">=0.10.0",
    "@toimc/core": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@mastra/core": { "optional": true }
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./mastra": {
      "types": "./dist/mastra.d.ts",
      "import": "./dist/mastra.mjs",
      "require": "./dist/mastra.cjs"
    }
  }
}
```

注意：现有 package.json 无 `peerDependencies` 字段则新增；`@toimc/core` 目前在 `dependencies`，保持不动（workspace 内用）；`@mastra/core` 留在 devDependencies（pnpm add 默认写入 dependencies，需手动移到 devDependencies）。

- [ ] **Step 3: vite.config.ts 增加 mastra 入口**

读现有 `packages/agents/vite.config.ts`（vite-plugin-dts 库模式），为 `build.lib.entry` 增加 `mastra: 'src/mastra/index.ts'`（多入口对象形式），`rollupOptions.external` 增加 `'@mastra/core'`、`'@mastra/core/agent'`、`'/agent'`（以现有 external 写法为准——若现有配置用数组，追加这些字符串）。产出目标：`dist/mastra.mjs` / `dist/mastra.cjs` / `dist/mastra.d.ts`。

- [ ] **Step 4: 创建占位入口并验证构建**

创建 `packages/agents/src/mastra/index.ts`：

```ts
export {}
```

```bash
corepack pnpm --filter @toimc/agents build
ls packages/agents/dist/ | grep mastra
```

Expected: 输出含 `mastra.mjs`、`mastra.cjs`、`mastra.d.ts`；主入口产物 `index.mjs` 体积不因 mastra 变大（对照构建前大小）。

- [ ] **Step 5: Commit**

```bash
git add packages/agents packages/mock-server pnpm-lock.yaml
git commit -m "chore(agents): 增加 mastra 子路径构建脚手架与可选依赖"
```

---

### Task 2: MastraAdapter 实现（核心映射）

**Files:**
- Create: `packages/agents/src/mastra/index.ts`（正式内容替换占位）
- Create: `packages/agents/src/mastra/types.ts`

- [ ] **Step 1: 写类型文件** `packages/agents/src/mastra/types.ts`

```ts
import type { Agent } from '@mastra/core/agent'
import type { ToolDefinition } from '../types'

/** Mastra 工具对象（createTool 产物）；ToolDefinition 数组形态经 factory 包装 */
export type MastraTool = Parameters<typeof Object>[0] extends never ? never : Record<string, unknown>

/** createMastraModel 配置：服务商/模型相关的一切都在这里（易变层） */
export interface MastraModelConfig {
  /** 对外模型 id（registry 注册名 / 前端 model 参数） */
  id: string
  name?: string
  description?: string
  /** Mastra model 字段：'provider/model' 字符串 | { id, url } 对象 | AI SDK 实例 */
  model: string | Record<string, unknown>
  instructions?: string
  /** createTool 产物字典，如 { getWeather } */
  tools?: Record<string, unknown>
  /** Memory 实例（@mastra/memory）；不传则无记忆 */
  memory?: unknown
  /** memory.resource，默认 'ai-chat' */
  resource?: string
  /** 透传给 Agent 的其他构造项（name/description 等） */
  agentOptions?: Record<string, unknown>
}

export interface MastraAdapterOptions {
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}

export interface MastraModel {
  adapter: MastraAdapter
  info: {
    name: string
    description: string
    provider?: string
  }
}
```

（实现时按 ESLint 反馈清理未用导入；`MastraTool` 若无价值可删，保留 `Record<string, unknown>` 即可——YAGNI。）

- [ ] **Step 2: 写 MastraAdapter**（替换 `src/mastra/index.ts` 占位）

```ts
import { generateId } from '@toimc/core'
import type { StreamChunk } from '@toimc/core'
import type { Agent } from '@mastra/core/agent'
import type { ChatRequest, ChatResponse, IModelAdapter } from '../types'
import type { MastraAdapterOptions } from './types'

/** AI SDK v5 fullStream 事件的最小结构（运行时按 type 分发） */
interface StreamPart {
  type: string
  id?: string
  toolName?: string
  text?: string
  delta?: string
  input?: unknown
  output?: unknown
  error?: unknown
}

/**
 * Mastra Agent → IModelAdapter 适配器。
 * chatStream 消费 format:'aisdk' 的 fullStream，映射为 StreamChunk 线协议：
 * text-delta→text；reasoning-delta→thinking；tool-input-start/-delta/-end→tool_call；
 * tool-output-available/-error→tool_result；error→error。done 由网关兜底补帧。
 */
export class MastraAdapter implements IModelAdapter {
  constructor(
    private readonly agent: Agent,
    private readonly options: MastraAdapterOptions = {},
  ) {}

  private memoryConfig(request: ChatRequest): { thread: string; resource: string } {
    const thread =
      typeof request.passthrough?.conversationId === 'string'
        ? (request.passthrough.conversationId as string)
        : generateId('mastra_thread')
    return { thread, resource: this.options.resource ?? 'ai-chat' }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const streamResult = await this.agent.stream(request.messages, {
      abortSignal: request.signal,
      memory: this.memoryConfig(request),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      format: 'aisdk',
    })
    const pendingArgs = new Map<string, string>()

    for await (const part of streamResult.fullStream as AsyncIterable<StreamPart>) {
      switch (part.type) {
        case 'text-delta': {
          if (part.delta) yield { type: 'text', content: part.delta }
          break
        }
        case 'reasoning-delta': {
          if (part.delta) yield { type: 'thinking', content: part.delta }
          break
        }
        case 'tool-input-start': {
          yield {
            type: 'tool_call',
            content: '',
            metadata: { toolCallId: part.id, toolName: part.toolName },
          }
          pendingArgs.set(part.id ?? '', '')
          break
        }
        case 'tool-input-delta': {
          const key = part.id ?? ''
          pendingArgs.set(key, (pendingArgs.get(key) ?? '') + (part.delta ?? ''))
          break
        }
        case 'tool-input-end': {
          const key = part.id ?? ''
          const raw = pendingArgs.get(key) ?? ''
          pendingArgs.delete(key)
          let args: Record<string, unknown> | undefined
          if (raw) {
            try { args = JSON.parse(raw) as Record<string, unknown> } catch { args = { raw } }
          }
          yield {
            type: 'tool_call',
            content: '',
            metadata: { toolCallId: part.id, toolName: part.toolName, toolArguments: args },
          }
          break
        }
        case 'tool-output-available': {
          yield {
            type: 'tool_result',
            content: '',
            metadata: { toolCallId: part.id, toolName: part.toolName, toolResult: part.output },
          }
          break
        }
        case 'tool-output-error': {
          const message =
            part.error instanceof Error ? part.error.message : String(part.error ?? 'tool error')
          yield {
            type: 'tool_result',
            content: '',
            metadata: { toolCallId: part.id, toolName: part.toolName, toolError: message },
          }
          break
        }
        case 'error': {
          const message =
            part.error instanceof Error ? part.error.message : String(part.error ?? 'stream error')
          yield { type: 'error', content: message }
          return
        }
        default:
          break
      }
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const result = await this.agent.generate(request.messages, {
      abortSignal: request.signal,
      memory: this.memoryConfig(request),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    })
    return {
      content: result.text ?? '',
      model: 'mastra-agent',
      usage: undefined,
    }
  }
}
```

（`result.text` 的访问方式以安装的 @mastra/core 实际类型为准调整——若类型报错，用 `(result as { text?: string }).text ?? ''` 收窄，禁止 `any`。`agent.stream(...)` 的 options 类型同理。）

- [ ] **Step 3: 构建 + 类型检查**

```bash
corepack pnpm --filter @toimc/agents build && corepack pnpm --filter @toimc/agents type-check
```

Expected: 双绿。

- [ ] **Step 4: Commit（无测试，测试在 Task 4 双盲补）**

```bash
git add packages/agents/src/mastra
git commit -m "feat(agents): MastraAdapter 流事件到 StreamChunk 的核心映射"
```

---

### Task 3: createMastraModel 声明式工厂

**Files:**
- Modify: `packages/agents/src/mastra/index.ts`（追加导出）

- [ ] **Step 1: 追加工厂函数**

```ts
import { Agent } from '@mastra/core/agent'
import type { MastraModelConfig, MastraModel } from './types'

/**
 * 声明式工厂：config → { adapter, info }，直接喂 registry.registerAdapter(id, adapter, info)。
 * 内部构造 Mastra Agent 并包成 MastraAdapter，宿主不接触 Mastra 类型。
 */
export function createMastraModel(config: MastraModelConfig): MastraModel {
  const agent = new Agent({
    id: config.id,
    name: config.name ?? config.id,
    ...(config.instructions ? { instructions: config.instructions } : {}),
    model: config.model as never,
    ...(config.tools ? { tools: config.tools as never } : {}),
    ...(config.memory ? { memory: config.memory as never } : {}),
  })
  const adapter = new MastraAdapter(agent, { resource: config.resource })
  return {
    adapter,
    info: {
      name: config.name ?? config.id,
      description: config.description ?? '',
      provider: 'mastra',
    },
  }
}
```

（`as never` 是对 Agent 构造器宽联合类型的收窄占位；若实际类型直接兼容则去掉断言。）

- [ ] **Step 2: 构建 + 类型检查**

```bash
corepack pnpm --filter @toimc/agents build && corepack pnpm --filter @toimc/agents type-check
```

- [ ] **Step 3: Commit**

```bash
git add packages/agents/src/mastra
git commit -m "feat(agents): createMastraModel 声明式工厂"
```

---

### Task 4: MastraAdapter / createMastraModel 双盲测试

> 双盲纪律：本任务由**独立 subagent** 执行，prompt 只提供 spec §3 映射表 + 上述类型签名 + StreamChunk 类型定义，**禁止读 `packages/agents/src/mastra/` 下的实现源码**。测试预期值全部手写字面量。

**Files:**
- Create: `packages/agents/src/mastra/mastra.test.ts`

- [ ] **Step 1: 写测试（先于读实现，stub 假 Agent）**

测试骨架（subagent 依据 spec 映射表补全断言字面量）：

```ts
import { describe, it, expect, vi } from 'vitest'

/** stub 假 Agent：stream() 产出脚本化事件序列 */
function fakeAgent(parts: StreamPartScript[], generateResult?: { text: string }) {
  return {
    stream: vi.fn(async (_messages: unknown, _opts: unknown) => ({
      fullStream: (async function* () {
        for (const p of parts) yield p
      })(),
    })),
    generate: vi.fn(async () => generateResult ?? { text: 'hi' }),
  }
}

// 用例清单（每条先红后绿）：
// 1. 纯文本流：text-delta×2 → 两个 text chunk，顺序与内容逐一断言
// 2. 思考流：reasoning-delta → thinking chunk
// 3. 工具调用完整链：tool-input-start → tool_call(id+name, 无 args)；
//    tool-input-delta ×2（分片 JSON）→ 不发包；
//    tool-input-end → tool_call 带合并后完整 toolArguments（手写字面量对象）；
//    tool-output-available → tool_result 带 toolResult
// 4. 工具失败：tool-output-error(error: new Error('boom')) → tool_result 的 toolError === 'boom'
// 5. 上游 error 事件 → error chunk 且流终止（后续事件不再产出）
// 6. 记忆映射：request.passthrough.conversationId='c1' → stream 被调时 opts.memory.thread==='c1'；
//    无 conversationId → thread 以生成前缀开头且非空
// 7. 中断语义：signal 已 abort 时适配器行为——stub stream 抛 AbortError，断言生成器向上抛（不吞）且无 error chunk
// 8. chat()：generate 返回 { text: '答案' } → ChatResponse.content === '答案'
// 9. createMastraModel：config → adapter 是 MastraAdapter 实例、info.provider === 'mastra'、name 兜底 id
```

- [ ] **Step 2: 红灯验证**

临时把 `src/mastra/index.ts` 中 `text-delta` 分支的 `part.delta` 改为 `part.text`（故意改错），跑测试：

```bash
corepack pnpm --filter @toimc/agents test
```

Expected: 纯文本流用例 FAIL（内容断言不匹配），证明断言真实校验。恢复实现。

- [ ] **Step 3: 转绿 + 全量**

```bash
corepack pnpm --filter @toimc/agents test
```

Expected: 全部 PASS。

- [ ] **Step 4: Commit（body 记录红灯证据）**

```bash
git add packages/agents/src/mastra/mastra.test.ts
git commit -m "test(agents): MastraAdapter 双盲测试

红灯证据：text-delta 分支改读 part.text 后，纯文本流用例断言失败（内容为空），
证明映射断言独立于实现。"
```

（dts 排除：`vite-plugin-dts` 已全局排除 `*.test.ts`，见主仓 f42a38a。）

---

### Task 5: mock-server 示例工具

**Files:**
- Create: `packages/mock-server/src/mastra/tools.ts`

- [ ] **Step 1: 写两个工具**

```ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/** 本地时间工具：零网络依赖，测试与演示友好 */
export const getTimeTool = createTool({
  id: 'get_time',
  description: '获取指定时区的当前时间；不传 timezone 则用系统本地时间',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA 时区名，如 Asia/Shanghai'),
  }),
  execute: async ({ context }) => {
    const now = new Date()
    const formatted = context.timezone
      ? now.toLocaleString('zh-CN', { timeZone: context.timezone })
      : now.toLocaleString('zh-CN')
    return { iso: now.toISOString(), formatted, timezone: context.timezone ?? 'local' }
  },
})

/** 天气工具：wttr.in 免费接口，5s 超时保护（对齐课程 17-02 方案） */
export const getWeatherTool = createTool({
  id: 'get_weather',
  description: '获取指定城市的当前天气（wttr.in）',
  inputSchema: z.object({
    city: z.string().describe('城市名，如 Beijing'),
  }),
  execute: async ({ context }) => {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(context.city)}?format=j1`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!response.ok) {
      throw new Error(`wttr.in ${response.status}`)
    }
    const data = (await response.json()) as {
      current_condition?: { temp_C?: string; weatherDesc?: { value?: string }[] }[]
    }
    const current = data.current_condition?.[0]
    return {
      city: context.city,
      temperatureC: current?.temp_C ?? '',
      description: current?.weatherDesc?.[0]?.value ?? '',
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add packages/mock-server/src/mastra/tools.ts
git commit -m "feat(mock-server): get_time 与 get_weather 示例工具"
```

---

### Task 6: mock-server env 门控组装 + Memory + telemetry

**Files:**
- Create: `packages/mock-server/src/mastra/register.ts`
- Create: `packages/mock-server/src/mastra/index.ts`（Mastra 实例，DevTools 入口）
- Modify: `packages/mock-server/src/app.ts`
- Test: `packages/mock-server/src/mastra/register.test.ts`

- [ ] **Step 1: 写注册模块** `src/mastra/register.ts`

```ts
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { createMastraModel } from '@toimc/agents/mastra'
import type { ModelRegistry } from '@toimc/agents'
import { getTimeTool, getWeatherTool } from './tools'

export interface MastraEnvConfig {
  /** Mastra model 字段，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选） */
  modelUrl?: string
  /** 展示名（可选） */
  modelName?: string
}

/** 从环境变量解析；MASTRA_MODEL 缺失返回 null（不注册，行为与现状一致） */
export function readMastraEnv(env: Record<string, string | undefined>): MastraEnvConfig | null {
  const model = env.MASTRA_MODEL
  if (!model) return null
  return {
    model,
    ...(env.MASTRA_MODEL_URL ? { modelUrl: env.MASTRA_MODEL_URL } : {}),
    ...(env.MASTRA_MODEL_NAME ? { modelName: env.MASTRA_MODEL_NAME } : {}),
  }
}

/** 组装并注册 mastra-agent 模型；返回创建的 model（供 Mastra 实例挂载） */
export function registerMastraAgent(
  registry: ModelRegistry,
  config: MastraEnvConfig,
  overrides: { memory?: unknown } = {},
) {
  const memory =
    overrides.memory ??
    new Memory({
      storage: new LibSQLStore({ url: 'file:.temp/mastra.db' }),
    })
  const created = createMastraModel({
    id: 'mastra-agent',
    name: config.modelName ?? 'Mastra Agent',
    description: `Mastra 驱动的 Agent（${config.model}），支持工具调用与会话记忆`,
    model: config.modelUrl ? { id: config.model, url: config.modelUrl } : config.model,
    instructions:
      '你是 ai-chat-ui 的演示 Agent。需要时间或天气信息时调用对应工具，回答保持简洁。',
    tools: { getTimeTool, getWeatherTool },
    memory,
  })
  registry.registerAdapter('mastra-agent', created.adapter, created.info)
  return created
}
```

- [ ] **Step 2: Mastra 实例**（`src/mastra/index.ts`，DevTools 入口）

```ts
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'

/**
 * MASTRA_TELEMETRY=true 时由 register 流程写入 agents；
 * npx mastra dev 读取此实例起 DevTools（默认 4111 端口）。
 */
export let mastraInstance: Mastra | null = null

export function attachMastraInstance(agents: Record<string, Agent>) {
  mastraInstance = new Mastra({
    agents,
    ...(process.env.MASTRA_TELEMETRY === 'true'
      ? { telemetry: { enabled: true } }
      : {}),
  })
  return mastraInstance
}
```

- [ ] **Step 3: 接线 app.ts**

在 `createMockApp()` 的 mock 注册之后追加：

```ts
import { readMastraEnv, registerMastraAgent } from './mastra/register'
// ...
  const mastraEnv = readMastraEnv(process.env)
  if (mastraEnv) {
    const created = registerMastraAgent(registry, mastraEnv)
    if (process.env.MASTRA_TELEMETRY === 'true') {
      const { attachMastraInstance } = await import('./mastra/index')
      attachMastraInstance({ 'mastra-agent': /* Agent 实例，从 created.adapter 暴露或重构返回 */ created.agent })
    }
  }
```

（若 `createMastraModel` 返回值不含 agent 实例，把 `MastraModel` 增加可选 `agent` 字段并在工厂里返回——Task 3 类型同步改。`createMockApp` 变 async 时，同步更新 `src/index.ts` 的调用与 `app.test.ts`。）

- [ ] **Step 4: 门控测试** `src/mastra/register.test.ts`

```ts
// 1. readMastraEnv：空环境 → null；MASTRA_MODEL 存在 → { model }；URL/NAME 可选字段透传
// 2. registerMastraAgent（注入 fake createMastraModel 返回 { adapter: {}, info: {...} }，vi.mock '@toimc/agents/mastra'）：
//    registry.registerAdapter 被以 ('mastra-agent', adapter, info) 调用
// 3. app 集成（app.test.ts 风格）：process.env 无 MASTRA_MODEL 时 GET /api/models 仍只有 3 个 mock（回归）
```

- [ ] **Step 5: 红灯→绿灯→Commit**

```bash
corepack pnpm --filter @toimc/mock-server test
git add packages/mock-server/src
git commit -m "feat(mock-server): env 门控注册 Mastra Agent 与 Memory/telemetry 接线"
```

---

### Task 7: 全量验证

- [ ] **Step 1: 构建全链**

```bash
corepack pnpm --filter @toimc/core --filter @toimc/agents --filter @toimc/server build
```

- [ ] **Step 2: 三绿**

```bash
corepack pnpm test
corepack pnpm type-check
corepack pnpm lint
```

- [ ] **Step 3: 主入口 tree-shaking 不回退验证**

```bash
corepack pnpm --filter @toimc/agents exec npx agadoo packages/agents/dist/index.mjs
```

Expected: 所有命名导出可 tree-shake（若主入口本就含不可摇的导出，对照 dev 分支基线不新增失败项）。

- [ ] **Step 4: 无 env 冒烟（回归）**

```bash
MOCK_SERVER_PORT=8799 corepack pnpm --filter @toimc/mock-server start &
sleep 2 && curl -s http://localhost:8799/api/models | head -c 300
kill %1
```

Expected: 返回 3 个 mock 模型 JSON，无 mastra-agent。

---

### Task 8: 文档同步（docs-sync 门禁）

**Files:**
- Modify: `packages/docs/guide/server.md`
- Modify: `README.md`

- [ ] **Step 1: server.md 新增「Mastra Agent 接入」章节**

内容骨架：适用场景（要工具调用/记忆的 Agent 场景）→ 安装（`pnpm add @toimc/agents @mastra/core @mastra/memory @mastra/libsql zod`）→ `createMastraModel` 用法示例（含 `{ id, url }` 自定义端点写法、DeepSeek 示例）→ `registerAdapter` 注册 → 工具定义示例（get_time 同款）→ Memory 与 thread/resource 说明（conversationId 自动映射）→ DevTools（`MASTRA_TELEMETRY=true` + `npx mastra dev`）→ 事件映射表（spec §3 同款表格）。

- [ ] **Step 2: README.md 更新**

包依赖图加 `mock-server → @toimc/agents/mastra（可选）`；能力列表补「Mastra Agent 接入（工具调用/记忆/监控）」。

- [ ] **Step 3: docs 构建验证**

```bash
corepack pnpm --filter docs build 2>&1 | tail -5
```

Expected: SSR 构建零报错。

- [ ] **Step 4: Commit**

```bash
git add packages/docs README.md
git commit -m "docs(server): Mastra Agent 接入指南与 README 同步"
```

---

### Task 9: 合并收尾（主目录执行）

- [ ] **Step 1: 确认 worktree 内全部提交、三绿**

- [ ] **Step 2: 主目录合并**

```bash
cd /Users/toimc/Downloads/2025vite+vue3课程/notes/09/resources/ai-chat-ui
git checkout dev
git merge --no-ff feat/mastra-agent-integration -m "Merge branch 'feat-mastra-agent-integration': Mastra 接入 server 服务侧"
```

- [ ] **Step 3: 清理**

```bash
git worktree remove .claude/worktrees/feat-mastra-agent
git branch -D feat/mastra-agent-integration
```

- [ ] **Step 4: 主目录全量回归**

```bash
corepack pnpm install && corepack pnpm test && corepack pnpm type-check && corepack pnpm lint
```

**后续（不在本计划内）**：真实服务商配置打通（DeepSeek/GLM env 实测）、`notes/15/02、03` 课程笔记回写、DevTools 实机验证。
