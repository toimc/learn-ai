# Mastra 深度集成 server 与子模块重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec 14 把双链路收敛为 8787 网关单链路：`@toimc/server` 新增 `/mastra` 子路径、mock-server 改名 dev-server 并收敛 agent/工具定义、mastra-app 退役（Studio 能力保留）、playground 收敛为单线。

**Architecture:** 机制进库（server/mastra 子路径复用 `@toimc/agents/mastra` 的 `createMastraModel`，optional peer）、实例进服务（dev-server 持有全部 agent 定义与 Studio 静态导出）、一线对外（前端只留 sse-adapter）。双入口分离：`src/index.ts`（服务，env 门控）与 `src/mastra/index.ts`（Studio，静态导出）互不 import。

**Tech Stack:** TypeScript / Hono / Mastra 1.60 / Vitest / pnpm workspace

**Spec:** `docs/superpowers/spec/14-Mastra深度集成server与子模块重构-20260828.md`

**测试纪律**：新测试红灯先行（先跑失败再实现）；预期值写死字面量；全量三绿（`pnpm test`、各包 `type-check`、`pnpm lint`）才算完成。

**并行编排**（subagent-driven 派发用）：

```
Wave 1: Task 1（server 子路径）
Wave 2: Task 2（dev-server 重组，依赖 Task 1）
Wave 3: Task 3（删 mastra-app）∥ Task 4（playground 收敛）——路径不相交，可并行
Wave 4: Task 5（docs + CLAUDE.md 同步）
Wave 5: Task 6（FR8 演示 + 全量验证）
```

所有任务在 worktree `.claude/worktrees/feat-server-mastra-integration` 内执行。

---

### Task 0: 开 worktree（主会话执行，不派 subagent）

- [ ] **Step 0.1: 主目录确认干净后开 worktree**

```bash
cd /Users/toimc/Downloads/2025vite+vue3课程/notes/09/resources/ai-chat-ui
git status --short          # 期望：空（spec 14 已提交 1fb37db）
git worktree add .claude/worktrees/feat-server-mastra-integration -b feat/server-mastra-integration dev
```

- [ ] **Step 0.2: 后续所有任务的 cwd 都是 worktree 目录**

```bash
cd .claude/worktrees/feat-server-mastra-integration
pnpm install                # worktree 首次需要链接依赖
pnpm -C packages/agents build   # agents dist（vitest 走 src alias，不需要；保险起见）
```

---

### Task 1: `@toimc/server` 新增 `/mastra` 子路径

**Files:**
- Create: `packages/server/src/mastra/index.ts`
- Create: `packages/server/src/mastra/index.test.ts`
- Modify: `packages/server/package.json`（exports + optional peer）
- Modify: `packages/server/vite.config.ts`（多入口构建）
- Modify: `vitest.config.ts`（新增 alias，注意排在 `@toimc/server` 之前）

- [ ] **Step 1.1: vitest.config.ts 加 alias（先于主入口，前缀匹配先到先得）**

```typescript
      // 子路径须列在主入口之前（alias 前缀匹配，先到先得）
      '@toimc/server/mastra': fileURLToPath(
        new URL('./packages/server/src/mastra/index.ts', import.meta.url),
      ),
      '@toimc/server': fileURLToPath(
        new URL('./packages/server/src/index.ts', import.meta.url),
      ),
```

- [ ] **Step 1.2: 写失败测试 `packages/server/src/mastra/index.test.ts`**

参照 `packages/mock-server/src/mastra/register.test.ts` 的 `vi.hoisted + vi.mock('@toimc/agents/mastra')` 模式（同仓先例）：

```typescript
import { describe, expect, it, vi } from 'vitest'
import type { Hono } from 'hono'

const fakes = vi.hoisted(() => {
  const fakeAdapter = {
    async *chatStream() {},
    async chat() {
      return { content: '', model: 'x' }
    },
  }
  const created = vi.fn(async () => ({
    adapter: fakeAdapter,
    info: { name: 'Chat Agent', description: 'd', provider: 'mastra' },
    agent: { __marker: 'agent' },
  }))
  return { fakeAdapter, created }
})

vi.mock('@toimc/agents/mastra', () => ({
  // createMastraModel 是 async 工厂（内部动态加载 @mastra/core），mock 保持同形态
  createMastraModel: fakes.created,
}))

import { createMastraGateway } from './index'
import type { MastraAgentDefinition } from './index'

const chatAgent: MastraAgentDefinition = {
  id: 'chat-agent',
  name: 'Chat Agent',
  model: 'deepseek/deepseek-chat',
  instructions: '演示指令',
  tools: { getTimeTool: { __marker: 'time-tool' } },
  memory: vi.fn(() => ({ __marker: 'memory' })),
}

async function modelIds(app: Hono): Promise<string[]> {
  const res = await app.request('/api/models')
  const body = (await res.json()) as Array<{ id: string }>
  return body.map((m) => m.id)
}

describe('createMastraGateway', () => {
  it('agents 定义逐个注册为网关模型（/api/models 可见）', async () => {
    const { app, registry } = await createMastraGateway({ agents: [chatAgent] })
    expect(await modelIds(app)).toContain('chat-agent')
    expect(registry.get('chat-agent')).toBe(fakes.fakeAdapter)
    expect(fakes.created).toHaveBeenCalledTimes(1)
  })

  it('无 agents 时为纯网关（models 数组路径保留）', async () => {
    const { app } = await createMastraGateway({
      models: [{ id: 'mock-pro', provider: 'openai', model: 'm', apiKey: 'k' }],
    })
    expect(await modelIds(app)).toContain('mock-pro')
    expect(fakes.created).not.toHaveBeenCalled()
  })

  it('agent 构建失败时抛出含 agent id 的可读错误', async () => {
    fakes.created.mockRejectedValueOnce(new Error('缺 @mastra/core'))
    await expect(
      createMastraGateway({ agents: [chatAgent] }),
    ).rejects.toThrow('chat-agent')
    fakes.created.mockClear()
  })

  it('memory 工厂在注册时被调用一次', async () => {
    await createMastraGateway({ agents: [chatAgent] })
    expect(chatAgent.memory).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 1.3: 跑测试确认红灯**

```bash
pnpm vitest run packages/server/src/mastra/index.test.ts
```
期望：FAIL（`./index` 模块不存在）。

- [ ] **Step 1.4: 实现 `packages/server/src/mastra/index.ts`**

```typescript
import type { Hono } from 'hono'
import { ModelRegistry } from '@toimc/agents'
import { createMastraModel } from '@toimc/agents/mastra'
import { createChatGateway } from '../create-gateway'
import type { GatewayOptions } from '../types'

/** agent 定义：纯配置对象（服务层组装），不含任何 Mastra 类型依赖 */
export interface MastraAgentDefinition {
  /** 网关模型 id（/api/models 列表项与前端 model 参数） */
  id: string
  name?: string
  description?: string
  /** Mastra model 字段：'provider/model' 串或 { id, url, apiKey? } 对象 */
  model: string | Record<string, unknown>
  instructions?: string
  /** createTool 产物字典 */
  tools?: Record<string, unknown>
  /** Memory 实例工厂（惰性：注册时调用一次；不传则无记忆） */
  memory?: () => unknown
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}

export interface MastraGatewayOptions extends Omit<GatewayOptions, 'models'> {
  /** 静态模型（mock 剧本等），原 GatewayOptions.models 数组形态保留 */
  models?: GatewayOptions['models']
  /** mastra agent 定义列表；逐个构建并注册为网关模型 */
  agents?: MastraAgentDefinition[]
}

/**
 * 一行组装：网关 + mastra agents 深度集成（spec 14 §4）。
 * agent 构建失败（依赖缺失/env 非法）整体抛可读错误——启动即失败优于静默降级。
 */
export async function createMastraGateway(
  options: MastraGatewayOptions,
): Promise<{ app: Hono; registry: ModelRegistry }> {
  const { models, agents = [], ...gatewayOptions } = options

  const registry =
    models instanceof ModelRegistry
      ? models
      : (models ?? []).reduce(
          (r, config) => r.register(config),
          new ModelRegistry(),
        )

  for (const def of agents) {
    try {
      const created = await createMastraModel({
        id: def.id,
        name: def.name,
        description: def.description,
        model: def.model,
        ...(def.instructions ? { instructions: def.instructions } : {}),
        ...(def.tools ? { tools: def.tools } : {}),
        ...(def.memory ? { memory: def.memory() } : {}),
        ...(def.resource ? { resource: def.resource } : {}),
      })
      registry.registerAdapter(def.id, created.adapter, created.info)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `mastra agent「${def.id}」注册失败：${message}（检查 @mastra/core 是否安装与模型配置）`,
      )
    }
  }

  const app = createChatGateway({ ...gatewayOptions, models: registry })
  return { app, registry }
}
```

- [ ] **Step 1.5: 跑测试确认绿灯**

```bash
pnpm vitest run packages/server/src/mastra/index.test.ts
```
期望：PASS 4 条。

- [ ] **Step 1.6: 构建配置——`packages/server/vite.config.ts` 多入口（对齐 agents 包先例）**

```typescript
export default defineConfig({
  plugins: [dts({ rollupTypes: true, exclude: ['src/**/*.test.ts'] })],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        mastra: 'src/mastra/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) =>
        format === 'es' ? `${name}.mjs` : `${name}.cjs`,
    },
    rollupOptions: {
      // hono 与 workspace 依赖保持 external，由消费侧安装
      external: ['hono', /^@toimc\//, /^@mastra\//],
    },
  },
})
```

- [ ] **Step 1.7: `packages/server/package.json` 加子路径导出与 optional peer**

exports 增加（保留原 `.` 项）：

```json
    "./mastra": {
      "types": "./dist/mastra/index.d.ts",
      "import": "./dist/mastra.mjs",
      "require": "./dist/mastra.cjs"
    }
```

新增（与 agents 包同款语义）：

```json
  "peerDependencies": {
    "@mastra/core": "^1.60.0"
  },
  "peerDependenciesMeta": {
    "@mastra/core": {
      "optional": true
    }
  }
```

- [ ] **Step 1.8: 验证构建产物 + 主入口零增长（NFR1）**

```bash
pnpm -C packages/server build
ls packages/server/dist/          # 期望含 mastra.mjs / mastra.cjs / mastra/index.d.ts
node -e "require('./packages/server/dist/mastra.cjs')"   # CJS 可加载（不触发动态 import）
```

- [ ] **Step 1.9: 全量回归 + 提交**

```bash
pnpm vitest run packages/server
git add packages/server vitest.config.ts
git commit -m "feat(server): 新增 /mastra 子路径——agent定义驱动的网关集成

createMastraGateway 复用 @toimc/agents/mastra 工厂，@mastra/core 为
optional peer，主入口零新增依赖（spec 14 §4）。测试红灯先行。"
```

---

### Task 2: mock-server → dev-server 改名与目录重组

**Files:**
- Rename: `packages/mock-server` → `packages/dev-server`（git mv 保历史）
- Create: `packages/dev-server/src/env.ts` + `env.test.ts`
- Create: `packages/dev-server/src/agents/{index.ts,chat-agent.ts,model-config.ts,model-config.test.ts}`
- Create: `packages/dev-server/src/tools/{get-time.ts,get-weather.ts,get-time.test.ts,get-weather.test.ts}`
- Create: `packages/dev-server/src/memory.ts`
- Create: `packages/dev-server/src/mastra/index.ts` + `index.test.ts`（静态导出，替代原 attachMastraInstance）
- Modify: `packages/dev-server/src/app.ts`（重写为 createDevApp，用 createMastraGateway）
- Modify: `packages/dev-server/src/index.ts`（env/端口/日志文案）
- Modify: `packages/dev-server/src/routes/providers.ts`（registerRuntimeProvider 内联迁入）
- Delete: `packages/dev-server/src/mastra/{register.ts,index.ts,tools.ts}`、`register.test.ts`
- Move: `src/mock-adapter.ts`+`src/scenarios.ts`+`src/types.ts`+`src/data/` → `src/mock/`
- Modify: `packages/dev-server/package.json`（name/scripts/.env.example）
- Move: `packages/mastra-app/src/mastra/agents/model-config.ts` 与其测试（定义迁入，**mastra-app 本体 Task 3 才删**）

- [ ] **Step 2.1: git mv 改名（保历史）+ package.json**

```bash
git mv packages/mock-server packages/dev-server
```

`packages/dev-server/package.json`：`"name": "@toimc/dev-server"`；scripts 改为：

```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "studio": "mastra studio",
    "build": "mastra build",
    "start:mastra": "mastra start",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
```

devDependencies 增加 `"mastra": "^1.26.0"`（从 mastra-app 版本对齐）。`pnpm install` 刷新 lockfile。

- [ ] **Step 2.2: mock 相关文件归位 `src/mock/`**

```bash
cd packages/dev-server/src
git mv mock-adapter.ts mock/mock-adapter.ts
git mv mock-adapter.test.ts mock/mock-adapter.test.ts
git mv scenarios.ts mock/scenarios.ts
git mv scenarios.test.ts mock/scenarios.test.ts
git mv types.ts mock/types.ts
git mv data mock/data
cd ../../..
```

全包 grep `from './mock-adapter'`、`from './scenarios'`、`from './types'`、`from './data` 并修正为 `./mock/...` 相对路径。

- [ ] **Step 2.3: 写失败测试 `src/env.test.ts`（env 统一，spec 14 §5.4）**

```typescript
import { describe, expect, it } from 'vitest'
import { readDevServerEnv } from './env'

describe('readDevServerEnv', () => {
  it('缺 MASTRA_MODEL 时 mastra 为 null（纯 mock 模式），端口默认 8787', () => {
    const env = readDevServerEnv({})
    expect(env.mastra).toBeNull()
    expect(env.port).toBe(8787)
    expect(env.telemetry).toBe(false)
  })

  it('MASTRA_MODEL 存在即启用 mastra agents，可选字段按需带入', () => {
    const env = readDevServerEnv({
      MASTRA_MODEL: 'deepseek/deepseek-chat',
      MASTRA_MODEL_URL: 'https://gw.example/v1',
      MASTRA_MODEL_API_KEY: 'sk-x',
      MASTRA_MODEL_NAME: 'Chat Agent',
      MASTRA_TELEMETRY: 'true',
      MASTRA_TOKEN: 't',
      DEV_SERVER_PORT: '9000',
    })
    expect(env.mastra).toEqual({
      model: 'deepseek/deepseek-chat',
      modelUrl: 'https://gw.example/v1',
      modelApiKey: 'sk-x',
      modelName: 'Chat Agent',
    })
    expect(env.telemetry).toBe(true)
    expect(env.token).toBe('t')
    expect(env.port).toBe(9000)
  })

  it('MASTRA_MODEL 存在但 URL/KEY 缺省时仅含 model', () => {
    const env = readDevServerEnv({ MASTRA_MODEL: 'deepseek/deepseek-chat' })
    expect(env.mastra).toEqual({ model: 'deepseek/deepseek-chat' })
  })
})
```

- [ ] **Step 2.4: 跑红灯**

```bash
pnpm vitest run packages/dev-server/src/env.test.ts
```
期望：FAIL（`./env` 不存在）。

- [ ] **Step 2.5: 实现 `src/env.ts`**

```typescript
/** dev-server 环境配置（spec 14 §5.4：两套 MASTRA_* 前缀统一为一套） */
export interface MastraEnv {
  /** 模型路由串，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选） */
  modelUrl?: string
  /** 自定义端点的 API key（url 场景必传：Mastra url 场景不自动读 provider env） */
  modelApiKey?: string
  /** 展示名（可选） */
  modelName?: string
}

export interface DevServerEnv {
  /** HTTP 端口，默认 8787 */
  port: number
  /** 存在即启用 mastra agents；null = 纯 mock 模式 */
  mastra: MastraEnv | null
  /** Studio 遥测开关（src/mastra/index.ts 消费） */
  telemetry: boolean
  /** 网关 Bearer（可选；/health 保持公开） */
  token?: string
}

export function readDevServerEnv(
  env: Record<string, string | undefined> = process.env,
): DevServerEnv {
  const parsedPort = Number(env.DEV_SERVER_PORT)
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8787
  const model = env.MASTRA_MODEL
  return {
    port,
    mastra: model
      ? {
          model,
          ...(env.MASTRA_MODEL_URL
            ? { modelUrl: env.MASTRA_MODEL_URL }
            : {}),
          ...(env.MASTRA_MODEL_API_KEY
            ? { modelApiKey: env.MASTRA_MODEL_API_KEY }
            : {}),
          ...(env.MASTRA_MODEL_NAME
            ? { modelName: env.MASTRA_MODEL_NAME }
            : {}),
        }
      : null,
    telemetry: env.MASTRA_TELEMETRY === 'true',
    ...(env.MASTRA_TOKEN ? { token: env.MASTRA_TOKEN } : {}),
  }
}
```

- [ ] **Step 2.6: 跑绿灯，然后迁移工具与 model-config（含测试随迁）**

```bash
pnpm vitest run packages/dev-server/src/env.test.ts   # PASS 3 条
```

迁移（源文件内容不变，仅拆分/移动 + import 修正）：
- `packages/dev-server/src/mastra/tools.ts` 的 `getTimeTool` → `src/tools/get-time.ts`；`getWeatherTool` → `src/tools/get-weather.ts`
- `packages/mastra-app/src/mastra/tools/get-time.test.ts`、`get-weather.test.ts` → `src/tools/` 随迁（对齐 import 路径）
- `packages/mastra-app/src/mastra/agents/model-config.ts` + `model-config.test.ts` → `src/agents/`（去掉注释里的 MASTRA_APP_ 表述，逻辑不变）

- [ ] **Step 2.7: 实现 `src/memory.ts`（两版合并，库名统一）**

```typescript
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

/** 会话记忆落盘位置（相对 dev-server 包目录；.temp/ 已在 .gitignore） */
const MEMORY_DB_URL = 'file:.temp/dev-server.db'

/** libsql 本地文件模式不自动建父目录，目录缺失时 SQLITE_CANTOPEN 直接崩启动 */
export function ensureDbDir(url: string): void {
  if (!url.startsWith('file:')) return
  const path = url.slice('file:'.length)
  if (!path || path === ':memory:') return
  mkdirSync(dirname(path), { recursive: true })
}

/** 默认记忆存储：本地 LibSQL 文件库，进程重启对话保留 */
export function createMemory(dbUrl: string = MEMORY_DB_URL): Memory {
  ensureDbDir(dbUrl)
  return new Memory({
    storage: new LibSQLStore({ id: 'dev-server-memory', url: dbUrl }),
  })
}
```

- [ ] **Step 2.8: 实现 `src/agents/chat-agent.ts` + 注册表 `src/agents/index.ts`**

```typescript
// src/agents/chat-agent.ts
import type { MastraAgentDefinition } from '@toimc/server/mastra'
import { createMemory } from '../memory'
import { resolveModelConfig } from './model-config'
import { getTimeTool } from '../tools/get-time'
import { getWeatherTool } from '../tools/get-weather'

export const CHAT_AGENT_ID = 'chat-agent'

/** chat-agent 与运行时 custom-agent 共用的系统指令（两条装配路径保持同一人设） */
export const CHAT_AGENT_INSTRUCTIONS =
  '你是 ai-chat-ui 的演示 Agent。需要时间或天气信息时调用对应工具，回答保持简洁。'

/** env → 网关 agent 定义（spec 14 §5.3：注册名统一为 chat-agent） */
export function chatAgentDefinition(config: {
  model: string
  modelUrl?: string
  modelApiKey?: string
  modelName?: string
}): MastraAgentDefinition {
  return {
    id: CHAT_AGENT_ID,
    name: config.modelName ?? 'Chat Agent',
    description: `Mastra 驱动的 Agent（${config.model}），支持工具调用与会话记忆`,
    model: resolveModelConfig(config),
    instructions: CHAT_AGENT_INSTRUCTIONS,
    tools: { getTimeTool, getWeatherTool },
    memory: createMemory,
  }
}
```

```typescript
// src/agents/index.ts
import type { MastraAgentDefinition } from '@toimc/server/mastra'
import type { MastraEnv } from '../env'
import { chatAgentDefinition } from './chat-agent'

/**
 * agent 注册表（spec 14 FR8 的落点）：
 * 新增 agent = 在本目录加一个定义文件 + 此数组加一行。
 */
export function buildAgentDefinitions(
  env: MastraEnv,
): MastraAgentDefinition[] {
  return [chatAgentDefinition(env)]
}
```

新增 `src/agents/index.test.ts`（红灯先行）：

```typescript
import { describe, expect, it } from 'vitest'
import { buildAgentDefinitions } from './index'
import { CHAT_AGENT_ID } from './chat-agent'

describe('buildAgentDefinitions', () => {
  it('产出 chat-agent 定义：路由串直传 + 双工具 + memory 工厂', () => {
    const [def] = buildAgentDefinitions({ model: 'deepseek/deepseek-chat' })
    expect(def.id).toBe(CHAT_AGENT_ID)
    expect(def.model).toBe('deepseek/deepseek-chat')
    expect(Object.keys(def.tools ?? {})).toEqual(['getTimeTool', 'getWeatherTool'])
    expect(typeof def.memory).toBe('function')
  })

  it('自定义端点走 { id, url } 对象形态', () => {
    const [def] = buildAgentDefinitions({
      model: 'my-qwen3',
      modelUrl: 'https://gw.example/v1',
      modelApiKey: 'sk-x',
    })
    expect(def.model).toEqual({
      id: 'my-qwen3',
      url: 'https://gw.example/v1',
      apiKey: 'sk-x',
    })
  })
})
```

- [ ] **Step 2.9: 写失败测试 `src/mastra/index.test.ts`（静态导出）**

参照 `packages/mastra-app/src/mastra/index.test.ts` 适配（真依赖构建，不走 mock）：

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('src/mastra 静态导出（Studio 入口）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('缺 MASTRA_MODEL 时 import 即抛可读错误（Studio 需要真实模型）', async () => {
    vi.stubEnv('MASTRA_MODEL', '')
    await expect(import('./index')).rejects.toThrow('MASTRA_MODEL')
  })

  it('配置 env 后导出含 chat-agent 的 Mastra 实例', async () => {
    vi.stubEnv('MASTRA_MODEL', 'deepseek/deepseek-chat')
    const mod = await import('./index')
    expect(Object.keys(mod.mastra.getAgents?() ?? {})).toContain('chat-agent')
  })
})
```

- [ ] **Step 2.10: 实现 `src/mastra/index.ts`（静态导出，只被 mastra CLI 加载）**

```typescript
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { chatAgentDefinition, CHAT_AGENT_ID } from '../agents/chat-agent'
import { readDevServerEnv } from '../env'

/**
 * Studio / mastra build / mastra start 的入口：必须是静态命名导出
 * `export const mastra`（mastra CLI 静态分析模块级导出，工厂或 let 赋值拿不到——
 * spec 12 §3.1 约束继续生效）。
 * 模块加载即用 env 构建 agent：缺 MASTRA_MODEL 抛可读错误（Studio 本就需要真实模型）。
 * 服务入口 src/index.ts 不 import 本文件（纯 mock 模式零 mastra 依赖，spec 14 §5.2）。
 */
const env = readDevServerEnv()
if (!env.mastra) {
  throw new Error(
    '缺少环境变量 MASTRA_MODEL：Studio 需要真实模型，请在 packages/dev-server/.env 配置（参照 .env.example）',
  )
}

const def = chatAgentDefinition(env.mastra)
const chatAgent = new Agent({
  id: def.id,
  name: def.name ?? def.id,
  instructions: def.instructions ?? '',
  // 定义层宽松 Record 在此收窄（对齐 mastra-app 先例：env 组装只产 string / { id, url } 两种形态）
  model: def.model as ConstructorParameters<typeof Agent>[0]['model'],
  tools: def.tools as ConstructorParameters<typeof Agent>[0]['tools'],
  memory: def.memory ? (def.memory() as ConstructorParameters<typeof Agent>[0]['memory']) : undefined,
})

export const mastra = new Mastra({
  agents: { [CHAT_AGENT_ID]: chatAgent },
  ...(env.telemetry ? { telemetry: { enabled: true } } : {}),
})
```

- [ ] **Step 2.11: 重写 `src/app.ts` 为 createDevApp**

完整新文件（保留原 conversations onComplete 逻辑与 mock 三剧本注册）：

```typescript
import type { Hono } from 'hono'
import { createMastraGateway } from '@toimc/server/mastra'
import { ModelRegistry } from '@toimc/agents'
import { buildAgentDefinitions } from './agents'
import { readDevServerEnv } from './env'
import { createMockAdapter } from './mock/mock-adapter'
import { openApiSpec } from './openapi'
import { createConversationsRoutes } from './routes/conversations'
import { createProvidersRoutes } from './routes/providers'

/**
 * 组装 dev 演示服务：@toimc/server/mastra 网关 + mock 剧本 + mastra agents（env 门控）。
 * 线协议与前端 sse-adapter 完全一致（导出供测试用 app.request() 直接调用，不监听端口）。
 * async：MASTRA_MODEL 存在时要等 createMastraModel（内部动态加载 @mastra/core）完成注册。
 */
export async function createDevApp(env = readDevServerEnv()) {
  const conversations = createConversationsRoutes()

  const registry = new ModelRegistry()
  registry.registerAdapter('mock-pro', createMockAdapter('pro'), {
    name: 'Mock Pro',
    description: '全场景剧本，默认选择',
  })
  registry.registerAdapter('mock-flash', createMockAdapter('flash'), {
    name: 'Mock Flash',
    description: '同剧本，块间隔更短',
  })
  registry.registerAdapter('mock-thinking', createMockAdapter('thinking'), {
    name: 'Mock Thinking',
    description: '始终先输出思考过程',
  })

  const providers = createProvidersRoutes(registry)

  const { app } = await createMastraGateway({
    models: registry,
    agents: env.mastra ? buildAgentDefinitions(env.mastra) : [],
    ...(env.token ? { auth: { tokens: [env.token] } } : {}),
    chat: {
      // 流结束后把这一轮对话写回服务端会话历史（切走再切回仍在）
      onComplete(result) {
        const convId = result.body.conversationId
        if (!convId) return
        const lastUser = [...result.body.messages]
          .reverse()
          .find((m) => m.role === 'user')
        if (!lastUser) return
        conversations.appendExchange(convId, lastUser.content, result.assistant)
      },
    },
  })

  app.route('/conversations', conversations.app)
  app.route('/providers', providers.app)
  app.get('/openapi.json', (c) => c.json(openApiSpec))

  return app
}

export type DevApp = Awaited<ReturnType<typeof createDevApp>>
```

同时：
- 删除 `src/mastra/register.ts`、`src/mastra/index.ts`（旧 attach 版）、`src/mastra/tools.ts`、`register.test.ts`
- `src/routes/providers.ts`：把 `registerRuntimeProvider` + `ProviderFormPayload` + `ProviderOption` 从已删的 register.ts 内联进本文件（逻辑不变），tools/memory 改从 `../tools/get-time`、`../tools/get-weather`、`../memory` import；`providers.test.ts` 的 import 路径对齐
- `src/app.test.ts`：`createMockApp` → `createDevApp`，mastra 相关 mock 块删掉，补一条「无 env 时 /api/models 仅含 mock 三项」断言
- `src/index.ts`：`createDevApp()` + `DEV_SERVER_PORT` + 日志文案 `[dev-server]`

- [ ] **Step 2.12: 跑 dev-server 全部测试**

```bash
pnpm vitest run packages/dev-server
```
期望：全 PASS。

- [ ] **Step 2.13: 双入口隔离验证（spec 14 §5.2，纯 mock 冒烟）**

```bash
cd packages/dev-server
env -u MASTRA_MODEL npx tsx -e "
process.env.DEV_SERVER_PORT='0'
import('./src/app').then(async ({ createDevApp }) => {
  const app = await createDevApp()
  const res = await app.request('/api/models')
  const ids = (await res.json()).map((m) => m.id)
  if (JSON.stringify(ids) !== JSON.stringify(['mock-pro','mock-flash','mock-thinking']))
    throw new Error('unexpected models: ' + ids)
  console.log('纯 mock 模式 OK:', ids.join(','))
})" 
```
期望输出：`纯 mock 模式 OK: mock-pro,mock-flash,mock-thinking`（证明服务入口零 mastra 依赖）。

- [ ] **Step 2.14: Studio 冒烟（风险前置，spec 14 §8 首要风险）**

```bash
# 从主目录的 mastra-app/.env 迁移真实配置（若存在），改前缀：
mkdir -p packages/dev-server && ls ../../packages/mastra-app/.env 2>/dev/null
# 存在则：sed 's/MASTRA_APP_/MASTRA_/g' ../../packages/mastra-app/.env > .env
cd packages/dev-server && npx tsx -e "
process.env.MASTRA_MODEL ||= 'deepseek/deepseek-chat'
import('./src/mastra').then((m) => {
  const agents = Object.keys(m.mastra.getAgents())
  if (!agents.includes('chat-agent')) throw new Error('no chat-agent: ' + agents)
  console.log('静态导出 OK:', agents.join(','))
})"
```
期望输出：`静态导出 OK: chat-agent`。若 jiti/依赖链报错，按 spec 14 §8 对策处理（定义文件只依赖 @mastra/* 与 zod）。`pnpm studio` 完整验证放 Task 6（需要交互确认 Studio UI 可达，主会话人工过）。

- [ ] **Step 2.15: `.env.example` 与 type-check，提交**

`packages/dev-server/.env.example`：

```bash
# mastra agents（可选）：配置后 chat-agent 注册进网关；缺省纯 mock 模式
MASTRA_MODEL=deepseek/deepseek-chat

# 自定义 OpenAI 兼容端点（可选；配了 MASTRA_MODEL 才有意义）
# MASTRA_MODEL_URL=https://your-endpoint/v1
# 自定义端点的 API key（url 场景必传：Mastra url 场景不自动读 provider env）
# MASTRA_MODEL_API_KEY=sk-xxx

# 展示名（可选）
# MASTRA_MODEL_NAME=Chat Agent

# 网关 Bearer（可选；设置后 /api/chat 与 /api/models 需携带，/health 公开）
# MASTRA_TOKEN=

# Studio 遥测（可选）
# MASTRA_TELEMETRY=true

# 服务端口（默认 8787）
# DEV_SERVER_PORT=8787
```

```bash
pnpm -C packages/dev-server type-check
git add -A packages/dev-server pnpm-lock.yaml
git commit -m "refactor(dev-server): mock-server改名dev-server并收敛agent定义

- src/agents+src/tools+src/memory 定义收敛（原 mock-server 与 mastra-app 两处合一）
- createMastraGateway 组装，env 门控（MASTRA_MODEL 存在才注册 agents）
- src/mastra/index.ts 静态导出承接 Studio（替代 attachMastraInstance）
- env 统一为 MASTRA_* 一套（spec 14 §5.4），注册名统一 chat-agent"
```

---

### Task 3: 删除 mastra-app + 根 scripts 收口

**Files:**
- Delete: `packages/mastra-app/`（整包，定义已在 Task 2 迁移）
- Modify: `package.json`（根 scripts）
- Modify: `pnpm-lock.yaml`（pnpm install 自动）

前置检查：Task 2 已迁 `model-config`(+test)、`tools/get-time|get-weather`(+tests)、`instructions`（并入 chat-agent.ts）、`memory`（合并进 src/memory.ts）。

- [ ] **Step 3.1: 确认无残留依赖后删除**

```bash
grep -rn "mastra-app" package.json pnpm-workspace.yaml vitest.config.ts .github/ 2>/dev/null
git rm -r packages/mastra-app
pnpm install
```

- [ ] **Step 3.2: 根 scripts 收口（spec 14 §6.2）**

`package.json` scripts 调整为：

```json
  "dev": "concurrently -n docs,server -c blue,green \"pnpm -C packages/docs dev\" \"pnpm -C packages/dev-server dev\"",
  "dev:docs": "pnpm -C packages/docs dev",
  "dev:server": "pnpm -C packages/dev-server dev",
  "dev:studio": "pnpm -C packages/dev-server studio",
```

删除 `dev:mock`、`dev:mastra`、`dev:all` 三项。

- [ ] **Step 3.3: 全仓收口 grep**

```bash
grep -rn "mock-server\|mastra-app" --include="*.json" --include="*.ts" --include="*.yml" --include="*.yaml" . \
  | grep -v node_modules | grep -v dist | grep -v '.temp' | grep -v docs/superpowers | grep -v packages/docs
```
期望：仅剩 `packages/playground`（Task 4 处理）与 `packages/docs`（Task 5 处理）内的引用；其他命中清零（含 openapi.ts 文案、app 日志等）。

- [ ] **Step 3.4: 提交**

```bash
pnpm test
git add -A package.json pnpm-lock.yaml packages/mastra-app
git commit -m "refactor: 退役mastra-app包，根scripts收口为dev+dev:server+dev:studio

4111嵌入式服务线删除：SSE端点由网关/api/chat覆盖、运行时切模型由
/api/providers覆盖、Bearer由网关auth选项覆盖；Studio/build/start能力
随静态导出与脚本迁移至dev-server（spec 14 §3.3）"
```

---

### Task 4: playground 前端收敛（与 Task 3 并行，路径不相交）

**Files:**
- Delete: `packages/playground/src/adapters/mastra-adapter.ts` + `mastra-adapter.test.ts`
- Delete: `packages/playground/src/composables/mastra-runtime-model.ts` + `mastra-runtime-model.test.ts`
- Modify: `packages/playground/src/composables/useBackendSelector.ts` + `useBackendSelector.test.ts`（重写）
- Modify: `packages/playground/src/mock/dispatch-adapter.ts` + `dispatch-adapter.test.ts`（删 mastra 分支）
- Modify: `packages/playground/src/components/PlaygroundDemo.vue`（清理 mastra 线）
- Modify: `packages/playground/src/locales/index.ts`（backend keys + mock-server 文案）
- Modify: `packages/playground/src/index.ts`（若 re-export 了被删文件）

- [ ] **Step 4.1: 删除 4111 专属文件**

```bash
git rm packages/playground/src/adapters/mastra-adapter.ts packages/playground/src/adapters/mastra-adapter.test.ts
git rm packages/playground/src/composables/mastra-runtime-model.ts packages/playground/src/composables/mastra-runtime-model.test.ts
```

- [ ] **Step 4.2: 重写 `useBackendSelector.ts`（两后端 + 旧值迁移）**

完整新文件：

```typescript
import { ref } from 'vue'
import type { Ref } from 'vue'
import { checkHealth } from '../mock/sse-adapter'

/** 后端选择器两选项：local=本地剧本，dev-server=统一服务（mock + mastra agents） */
export type PlaygroundBackendId = 'local' | 'dev-server'

export const BACKEND_STORAGE_KEY = 'pg.backend'

const KNOWN_BACKENDS: readonly PlaygroundBackendId[] = ['local', 'dev-server']

/** 旧值迁移：spec 14 前的三后端值映射（未知值回退 local 安全默认） */
const LEGACY_ALIASES: Record<string, PlaygroundBackendId> = {
  'mock-server': 'dev-server',
  mastra: 'dev-server',
}

/** 远端后端基地址（探活与提示共用） */
export const BACKEND_BASE_URLS = {
  'dev-server': 'http://localhost:8787',
} as const

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface UseBackendSelectorOptions {
  /** 注入测试桩；缺省用浏览器 localStorage（SSR/隐私模式读写失败静默降级） */
  storage?: StorageLike
}

function defaultStorage(): StorageLike {
  if (typeof localStorage === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
  return localStorage
}

function safeGet(storage: StorageLike): PlaygroundBackendId {
  try {
    const value = storage.getItem(BACKEND_STORAGE_KEY)
    if (value && (KNOWN_BACKENDS as readonly string[]).includes(value)) {
      return value as PlaygroundBackendId
    }
    if (value && value in LEGACY_ALIASES) return LEGACY_ALIASES[value]
  } catch {
    // 读取失败回退默认
  }
  return 'local'
}

function safeSet(storage: StorageLike, id: PlaygroundBackendId) {
  try {
    storage.setItem(BACKEND_STORAGE_KEY, id)
  } catch {
    // 持久化失败不影响会话内选择
  }
}

/**
 * Playground 后端选择器：本地 Mock / dev-server 8787。
 * 选中 id 持久化 localStorage（pg.backend，旧值自动迁移）；切换远端前探活，
 * 不可达不切换并标记离线。选择只影响新会话（创建时快照，对齐 spec 11 语义）。
 */
export function useBackendSelector(options: UseBackendSelectorOptions = {}) {
  const storage = options.storage ?? defaultStorage()

  const backend: Ref<PlaygroundBackendId> = ref(safeGet(storage))
  /** null = 未探测 */
  const serverOnline: Ref<boolean | null> = ref(null)

  async function probeRemote(id: 'dev-server'): Promise<boolean> {
    const online = await checkHealth(BACKEND_BASE_URLS[id])
    serverOnline.value = online
    return online
  }

  /** 探测远端（挂载时初始化离线标记，不改变当前选中） */
  async function probeAll(): Promise<void> {
    await probeRemote('dev-server')
  }

  /** 探活结果为离线（未探测返回 false，不禁用） */
  function isOffline(id: PlaygroundBackendId): boolean {
    if (id === 'dev-server') return serverOnline.value === false
    return false
  }

  /** 切换后端：远端先探活，不可达返回 false 且保持原选中（重选当前远端项 = 重试探活） */
  async function selectBackend(id: PlaygroundBackendId): Promise<boolean> {
    if (id !== 'local' && !(await probeRemote(id))) return false
    backend.value = id
    safeSet(storage, id)
    return true
  }

  return {
    backend,
    serverOnline,
    probeAll,
    selectBackend,
    isOffline,
  }
}
```

`useBackendSelector.test.ts` 对齐重写：保留 storage 读写/回退用例（字段名改 `serverOnline`），**新增旧值迁移用例**：storage 预置 `'mock-server'` → 初值 `'dev-server'`；预置 `'mastra'` → `'dev-server'`；预置 `'unknown'` → `'local'`。删掉所有 mastra 探活相关用例。

- [ ] **Step 4.3: `dispatch-adapter.ts` 删 mastra 分支**

- `DispatchConversation.backend` 字段删除（连同 `'mock-server' | 'mastra'` 联合类型）
- `DispatchAdapterOptions.getMastraCustomModelActive` 删除
- `sendMessage` 中 `if (conv?.backend === 'mastra') {...}` 整块删除；`createMastraAdapter` import 删除
- 分发逻辑剩两路：`conv?.model` → sse-adapter；其余 → 本地 mockAdapter
- `dispatch-adapter.test.ts` 删除 mastra 路径用例，保留/对齐两路用例

- [ ] **Step 4.4: `PlaygroundDemo.vue` 清理 mastra 线（2329 行文件，按锚点手术）**

按 grep 锚点逐块处理（改完每块跑一次 `grep -n "mastra" PlaygroundDemo.vue` 观察收敛）：

1. L44 附近：删除 `from '../composables/mastra-runtime-model'` import 块
2. L73-84 附近：`useBackendSelector()` 解构改为 `{ backend, serverOnline, probeAll, selectBackend, isOffline }`；全文 `mockServerOnline` 引用改 `serverOnline`
3. L143 附近：`customModelActive` / custom-agent 端点注释与逻辑块删除
4. L232-233：会话快照 `backend?: 'mock-server' | 'mastra'` 字段及其赋值删除（L390 附近 `...(backendId.value === 'mastra' ? ...)` 特例删除）
5. L302-305：工具面板渲染条件 `Boolean(activeConv.value?.model) || activeConv.value?.backend === 'mastra'` → `Boolean(activeConv.value?.model)`
6. 模板区后端选择器：删掉 `Mastra · 4111` 选项按钮与相关 `t('pg.backend.mastra')` / `mastraDesc` / 离线态绑定；`mock-server · 8787` 标签文案 key 改 `devServer`
7. 会话列表中 mastra 会话徽标/标识（grep `mastra` 于 template）删除

验证收敛：

```bash
grep -n "mastra\|customModel\|4111" packages/playground/src/components/PlaygroundDemo.vue
```
期望：零命中。

- [ ] **Step 4.5: `src/index.ts` 与 locales 清理**

- `packages/playground/src/index.ts`：删除对已删文件的 re-export（grep `mastra-adapter\|mastra-runtime-model`）
- `locales/index.ts`：backend 区 `mockServer` key 改 `devServer: 'dev-server · 8787'`；删除 `mastra`/`mastraDesc` key（中英两份）；全文 `mock-server` 文案（L81/87/91/102-105/115 及英文对应）替换为 `dev-server`

- [ ] **Step 4.6: 测试 + type-check + 提交**

```bash
pnpm vitest run packages/playground
pnpm -C packages/playground type-check 2>/dev/null || pnpm type-check
git add -A packages/playground
git commit -m "refactor(playground): 退役4111前端线，收敛为sse-adapter单线

后端选择器三选项改两选项（local/dev-server，旧localStorage值自动迁移）；
dispatch-adapter删mastra分支；mastra-adapter与mastra-runtime-model删除
（spec 14 §6.1）"
```

---

### Task 5: docs 站 + 项目 CLAUDE.md 同步

**Files:**
- Modify: `packages/docs/guide/mastra.md`（重写为统一链路 + Studio 用法）
- Modify: `packages/docs/guide/server.md`、`installation.md`、`mock-api.md`、`playground.md`
- Modify: `packages/docs/.vitepress/config.ts`（若有 4111/mastra-app 引用）
- Modify: `CLAUDE.md`（ai-chat-ui 项目根）

- [ ] **Step 5.1: 逐文件同步（以 spec 14 §3/§5.4 为准）**

各文件处理要点：
- `guide/mastra.md`：重写——接入方式从「mastra-app 4111 独立服务」改为「dev-server 网关注册（MASTRA_MODEL env 门控）+ Studio（`pnpm dev:studio`，读 packages/dev-server/src/mastra/index.ts 静态导出）」；模型 id `mastra-agent` → `chat-agent`；env 表按 spec §5.4
- `guide/server.md`：新增 `@toimc/server/mastra` 子路径说明（createMastraGateway + MastraAgentDefinition，示例代码取自 Task 1 实现）
- `mock-api.md` / `playground.md`：`mock-server` → `dev-server`；4111 相关段落删除/改 Studio
- `installation.md`：env 示例对齐 `.env.example`；`pnpm dev:mastra`/`dev:all` → `pnpm dev:server`/`dev:studio`
- `.vitepress/config.ts`：grep `mastra\|mock-server` 命中处对齐（导航标题、链接）

- [ ] **Step 5.2: `CLAUDE.md`（项目根）同步**

- 「包依赖关系」：mock-server 条目改 `dev-server（dev 演示服务：mock 剧本 + mastra agents + Studio 宿主）`；删除 mastra-app 相关行
- 「常用命令」：`pnpm dev:mastra` → `pnpm dev:studio`（dev-server 包内 .env）；`pnpm dev:all` 删除，说明 `pnpm dev` 即 docs + dev-server 双起
- 「架构」图若提及 mock-server/mastra-app 一并对齐

- [ ] **Step 5.3: docs 构建验证 + 提交**

```bash
grep -rn "mastra-app\|4111\|mastra-agent" packages/docs CLAUDE.md | grep -v node_modules | grep -v dist
# 期望：仅 Studio 端口 4111 的合理表述（Studio 本身仍用 4111，允许保留）；mastra-app/mastra-agent 零命中
pnpm -C packages/docs build
git add packages/docs CLAUDE.md
git commit -m "docs: 同步统一链路架构——dev-server/mastra子路径/Studio用法

guide/mastra重写为网关注册+Studio；env表对齐spec14 §5.4；
模型id统一chat-agent；CLAUDE.md包清单与命令同步"
```

---

### Task 6: FR8 配置化验证 + 全量三绿 + 手工清单

- [ ] **Step 6.1: FR8 —— 新增 agent = 一个文件 + 一行注册**

临时创建 `packages/dev-server/src/agents/echo-agent.ts`：

```typescript
import type { MastraAgentDefinition } from '@toimc/server/mastra'
import type { MastraEnv } from '../env'

/** FR8 验证用最小 agent：无工具、独立指令（验证后删除） */
export function echoAgentDefinition(env: MastraEnv): MastraAgentDefinition {
  return {
    id: 'echo-agent',
    name: 'Echo Agent',
    description: 'FR8 配置化注册验证用',
    model: env.model,
    instructions: '你是回声助手：把用户的话原样复述一遍。',
  }
}
```

`src/agents/index.ts` 数组加一行 `echoAgentDefinition(env)`，然后：

```bash
cd packages/dev-server
MASTRA_MODEL=deepseek/deepseek-chat npx tsx -e "
import('./src/app').then(async ({ createDevApp }) => {
  const app = await createDevApp()
  const res = await app.request('/api/models')
  const ids = (await res.json()).map((m) => m.id)
  if (!ids.includes('echo-agent')) throw new Error('FR8 fail: ' + ids)
  console.log('FR8 OK:', ids.join(','))
})"
```
期望输出：`FR8 OK: mock-pro,mock-flash,mock-thinking,chat-agent,echo-agent`。

验证通过后**删除 echo-agent 文件与注册行**（不留验证残留），单独提交验证证据到 commit body。

- [ ] **Step 6.2: 全量三绿**

```bash
pnpm test
pnpm type-check
pnpm -C packages/dev-server type-check
pnpm -C packages/server type-check
pnpm lint
```

- [ ] **Step 6.3: 手工清单（主会话人工过，需真实 key 的项标注）**

1. 无 env：`pnpm dev` → playground 后端 `dev-server`，mock 三剧本对话正常（FR1）
2. 配 `MASTRA_MODEL`：模型列表含 `chat-agent`；问「北京现在几点、天气怎么样」→ 工具调用 + 流式正常（FR2，需真实 key）
3. `pnpm dev:studio` → Studio 可见 chat-agent、可对话、traces 正常（FR5，需真实 key）
4. providers 表单注册真实模型 → 出现在模型列表并可对话（FR6，需真实 key）
5. `MASTRA_TOKEN=xxx` → 无 Bearer 请求 401，`/health` 公开（FR4，可用 curl）
6. conversations 切换会话历史保留（FR7）

- [ ] **Step 6.4: 收尾提交 + 合并准备**

```bash
git status --short   # 期望：干净
git log --oneline dev..HEAD   # 查看分支全部提交
```

按 git-flow-worktree 规则合并回 dev（PR 或直接 merge），删除 worktree 与分支：

```bash
cd /Users/toimc/Downloads/2025vite+vue3课程/notes/09/resources/ai-chat-ui
git checkout dev && git merge --no-ff feat/server-mastra-integration
git worktree remove .claude/worktrees/feat-server-mastra-integration
git branch -D feat-server-mastra-integration
```

---

## Self-Review 记录

- **Spec 覆盖**：FR1-FR8 → Task 2.13/2.14/6.1/6.3；NFR1 → Task 1.8；NFR2 → Task 6.2；NFR3 → Task 2.13；NFR4 → Task 2.10 注释与实现；§5.4 env → Task 2.3-2.5；§6.1/6.2 → Task 4/5；删除清单 §5.5 → Task 2.11/3.1/4.1。无缺口。
- **占位符扫描**：无 TBD/TODO；PlaygroundDemo.vue 与 docs 文件为"按锚点手术+grep 收敛验证"式精确指令（2329 行文件不全文内联，验证命令保证收敛到零命中）。
- **类型一致性**：`MastraAgentDefinition` 字段（id/name/description/model/instructions/tools/memory/resource）在 Task 1 定义、Task 2 消费一致；`readDevServerEnv` 返回 `{ port, mastra, telemetry, token? }` 与 Task 2.11 `createDevApp(env)` 消费一致；`chat-agent` 注册名全文统一。
