# Mastra 深度集成 server 与子模块重构 — 需求规格

> 日期：2026-08-28 ｜ 状态：设计已获用户批准（方案A），待实施
> 前置：spec 09（网关与 agents 包）、spec 10（`@toimc/agents/mastra` 子路径）、spec 11（运行时 Provider 注册）、spec 12（Mastra 全家桶深度集成）
> **取代关系**：本 spec 收敛 spec 12 确立的「双链路」——4111 前端转协议链路退役，统一为 8787 网关单链路；Studio / `mastra build` / `mastra start` 全部保留，仅迁移宿主位置

## 1. 背景与目标

spec 09-12 把服务端从零搭到可用，但留下三条并行的服务路径与两处重复定义：

| # | 问题 | 现状 |
|---|------|------|
| 1 | mastra 游离在 server 体系外 | `@toimc/server` 纯网关不感知 mastra；mastra-app(4111) 是独立应用走 `@mastra/hono` 自有路由 |
| 2 | agent/工具定义两处重复 | chat-agent 与 get_time/get_weather 在 `mastra-app/src/mastra/` 和 `mock-server/src/mastra/` 各一份，instructions 内容已经不同（会漂移） |
| 3 | 前端两条 adapter 线 | playground 的 `sse-adapter`(8787 线协议) 与 `mastra-adapter`(4111 原生协议) 并存，后端选择器三选项 |
| 4 | 集成逻辑藏在演示服务里 | mastra 运行时注册埋在 mock-server，职责错位（mock 演示服务承担了正式集成） |

**目标**（分层原则：机制进库，实例进服务，一线对外）：

1. `@toimc/server` 新增可选子路径 `/mastra`：agent 定义（纯配置对象）→ 一行注册进网关
2. agent/工具定义收敛到唯一服务包 `dev-server`（原 mock-server 改名）
3. mastra-app 整包退役；Studio 与 mastra 原生部署能力随定义迁移保留
4. 前端收敛为 sse-adapter 单线
5. **架构验收口径：新增一个 agent = 新增一个定义文件 + 注册表一行**（为课程 16 章「配置化注册」与后续 docs-agent/explorer 打地基）

## 2. 用户已拍板的决策

1. **方案A**：机制进库（server 加 mastra 子路径）、agent 定义收敛一处、前端退一条线、mastra-app 瘦身为定义宿主——最终确定为整包删除
2. **服务包改名**：`mock-server` → `dev-server`（名字与职责对齐：mock 演示 + mastra 正式服务双模式）
3. **mastra-app 删除**：Studio / `mastra build` / `mastra start` 全保留（静态导出 + 脚本随包迁移到 dev-server）；仅删除重复的 4111 嵌入式服务线（`create-app` / `app-routes` / `bearer-auth` / `runtime-model`），其能力分别由网关 `/api/chat`、`/api/providers`、`auth` 选项覆盖
4. 重构先行、课程笔记（16 章重写）后置，本 spec 只覆盖代码重构

## 3. 架构总览

### 3.1 重构前（spec 12 双链路）

```
Playground ─┬─ sseAdapter ──▶ mock-server 8787 ──▶ @toimc/server 网关（mock 剧本 + 可选 mastra 运行时注册）
            └─ mastraAdapter ─▶ mastra-app 4111 ──▶ @mastra/hono MastraServer（/api/agents/*）
                                  （agent 定义重复维护于两包）
```

### 3.2 重构后（单链路）

```
┌────────────────── 发布的库（机制层）──────────────────┐
│ @toimc/core ← @toimc/agents（适配内核 /mastra：MastraAdapter/createMastraModel，不动）
│                      ↑
│              @toimc/server（网关 + ★新增 /mastra 子路径）
└──────────────────────┬───────────────────────────┘
                       │ 组装
┌──────────────────────▼───────────────────────────┐
│ dev-server（原 mock-server，唯一服务，8787）          │
│  ├─ src/agents/    agent 定义注册表（chat-agent…）    │
│  ├─ src/tools/     工具定义（get-time/get-weather）   │
│  ├─ src/mock/      mock 剧本（无 key 演示，保留）      │
│  ├─ src/routes/    conversations/providers（保留）    │
│  ├─ src/mastra/index.ts  ★静态导出（Studio 入口）      │
│  └─ src/index.ts   服务入口（env 门控注册，8787）      │
└──────────────────────────────────────────────────┘
Playground ──sse-adapter──▶ 8787（唯一线；mastra-adapter 退役）
Studio ──▶ dev-server 包内 `mastra studio`（读 src/mastra/index.ts 静态导出）
```

### 3.3 Studio 保留机制说明（用户确认过的关键点）

`mastra studio` / `mastra dev` / `mastra build` / `mastra start` 这些 CLI **只认静态命名导出 `export const mastra = new Mastra({...})`（默认路径 `src/mastra/index.ts`），不关心包名**。dev-server 保留该导出文件 + `mastra` devDependency + 对应 scripts，能力与现状完全等价。被删的仅是「自建 Hono 嵌 MastraServer」那条 4111 服务线。

## 4. `@toimc/server/mastra` 子路径设计

### 4.1 API

```typescript
// packages/server/src/mastra/ → 发布为 @toimc/server/mastra
import type { GatewayOptions } from '../types'

/** agent 定义：纯配置对象（服务层组装，不含任何 Mastra 类型依赖） */
export interface MastraAgentDefinition {
  /** 网关模型 id（/api/models 列表项与前端 model 参数） */
  id: string
  name?: string
  description?: string
  /** Mastra model 字段：'provider/model' 串或 { id, url, apiKey? } 对象（OpenAICompatibleConfig 形态） */
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

/** 一行组装：网关 + mastra agents 深度集成 */
export async function createMastraGateway(
  options: MastraGatewayOptions,
): Promise<{ app: Hono; registry: ModelRegistry }>
```

### 4.2 实现约束

- 内部复用 `@toimc/agents/mastra` 的 `createMastraModel`（其内部动态 `import('@mastra/core/agent')`，缺依赖时抛含安装指引的友好错误——`@toimc/server` **主入口零新增依赖**，`/mastra` 子路径把 `@mastra/core` 声明为 optional peer）
- agents 构建失败（依赖缺失/env 非法）时：整体抛出可读错误（启动即失败优于静默降级），错误信息指明是哪个 agent 定义失败
- `defaultModel` 缺省取注册表第一项的现有语义不变
- 主入口 `packages/server/src/index.ts` 不 re-export mastra 子路径内容（保持零依赖）

## 5. dev-server 包设计

### 5.1 目录结构

```
packages/dev-server/（原 mock-server 改名 git mv 迁移）
├── package.json        # @toimc/dev-server，private；scripts: dev/start/test/type-check + studio/build/start(mastra CLI)
├── .env.example        # 统一 env 样例（见 5.4）
└── src/
    ├── index.ts        # 服务入口：读env → createMastraGateway（agents 按 env 门控）→ 挂 conversations/providers/openapi → serve 8787
    ├── env.ts          # 统一 env 解析（MASTRA_* 一套）
    ├── agents/
    │   ├── index.ts    # ★注册表：export const agentDefinitions = [...]（新增 agent 只动这里）
    │   └── chat-agent.ts  # chat-agent 定义（instructions 以 mastra-app 版本为准；model 由 env 解析组装）
    ├── tools/
    │   ├── get-time.ts     # 两处重复收敛（内容一致，直接合并）
    │   └── get-weather.ts
    ├── memory.ts       # LibSQL memory 工厂（ensureDbDir 目录保障逻辑迁入，mock-server 与 mastra-app 两版合并）
    ├── mock/           # mock-adapter.ts / scenarios.ts / data/（原样迁入 src/mock/）
    ├── routes/
    │   ├── conversations.ts   # 原样
    │   └── providers.ts       # 保留；registerRuntimeProvider 改用 src/tools 与 src/memory
    ├── mastra/
    │   └── index.ts    # ★静态导出：export const mastra = new Mastra({ agents: {...由定义构建} })
    ├── openapi.ts      # 原样
    └── *.test.ts       # 随模块迁移
```

### 5.2 双模式与入口分离（关键约束）

- **`src/index.ts`（服务入口）不 import `src/mastra/index.ts`**：纯 mock 模式（无任何 MASTRA_* env）启动路径零 mastra 依赖，现有行为不回归
- **`src/mastra/index.ts`（Studio 入口）只被 mastra CLI 加载**：模块加载即用 env 构建全部 agent，缺 `MASTRA_MODEL` 抛可读错误——Studio 本来就需要真实模型，与现状 mastra-app 行为一致
- env 门控注册：`MASTRA_MODEL` 存在时 agent 定义进入 `createMastraGateway({ agents })`，缺省时 `agents: []`（纯 mock）
- telemetry：`MASTRA_TELEMETRY=true` 时 `src/mastra/index.ts` 的 Mastra 实例带 `telemetry: { enabled: true }`（沿用现状）

### 5.3 模型 id 命名决策

现状两个注册名：mock-server 注册 `mastra-agent`，mastra-app 的 agent id 为 `chat-agent`。统一为 **`chat-agent`**（与定义文件、Studio 内 agent 名一致）。docs 站与 playground 中引用 `mastra-agent` 模型 id 的地方同步更新。

### 5.4 env 统一映射

| 现状（两套） | 统一后 | 说明 |
|---|---|---|
| mock-server `MASTRA_MODEL` / mastra-app `MASTRA_APP_MODEL` | `MASTRA_MODEL` | 模型路由串，存在即启用 mastra agents |
| `MASTRA_MODEL_URL` / `MASTRA_APP_MODEL_URL` | `MASTRA_MODEL_URL` | 自定义 OpenAI 兼容端点 |
| （无）/ `MASTRA_APP_MODEL_API_KEY` | `MASTRA_MODEL_API_KEY` | 自定义端点的 key（url 场景必传，从 mastra-app 迁移语义） |
| `MASTRA_MODEL_NAME` | `MASTRA_MODEL_NAME` | 展示名（可选） |
| `MASTRA_TELEMETRY` / `MASTRA_APP_TELEMETRY` | `MASTRA_TELEMETRY` | 遥测开关 |
| `MASTRA_APP_TOKEN` | `MASTRA_TOKEN` | 网关 Bearer（挂 `auth` 选项；原 mastra-app 语义） |
| `MOCK_SERVER_PORT` / `MASTRA_APP_PORT` | `DEV_SERVER_PORT` | 服务端口默认 8787（Studio 端口由 mastra CLI 自管，不在本表） |

`.env.example` 更新为统一后的一套；README/docs 中 env 说明同步。

### 5.5 删除清单

| 删除项 | 理由 / 能力去向 |
|---|---|
| `packages/mastra-app/` 整包 | 定义迁入 dev-server；studio/build/start 脚本随包迁移 |
| mastra-app `create-app.ts` / `app-routes.ts` / `bearer-auth.ts` / `runtime-model.ts` 及测试 | 4111 嵌入式服务线退役：SSE 端点→网关 `/api/chat`；运行时切模型→`/api/providers`；Bearer→网关 `auth` |
| mock-server `src/mastra/register.ts` / `index.ts` / `tools.ts` | 逻辑上移：定义→`src/agents`+`src/tools`，attachMastraInstance→`src/mastra/index.ts` 静态导出 |
| playground `adapters/mastra-adapter.ts`、`composables/mastra-runtime-model.ts` 及测试 | 4111 前端线退役 |

保留不动：`@toimc/agents`（含 `/mastra` 子路径）、`@toimc/server` 现有主入口全部行为、mock 剧本与演示数据、conversations/providers 路由。

## 6. playground 与 docs 收敛

### 6.1 playground

- `useBackendSelector`：三后端 → 两后端 `local | dev-server`；`BACKEND_BASE_URLS` 改为 `{ 'dev-server': 'http://localhost:8787' }`；localStorage 旧值 `mock-server`/`mastra` 读取时按未知值回退 `local`（安全默认）并覆盖写回
- 删除 4111 探活（pingMastra/pingRuntimeModel）与 `mastra-runtime-model` 相关状态；dev-server 探活沿用现有 health 检查
- UI 后端选择器文案与 i18n key 同步（`packages/vue/src/locales` 与 playground 字典，中英双语）
- dispatch-adapter 等对 mock-server 基地址的引用改指 dev-server（8787 不变）

### 6.2 docs 站与根配置

- `packages/docs/` 下 6 个引用文件（`mock-api.md`、`playground.md`、`guide/mastra.md`、`guide/installation.md`、`guide/server.md`、`.vitepress/config.ts`）：4111 链路说明改为统一链路 + Studio 用法；模型 id `mastra-agent` → `chat-agent`；env 说明对齐 5.4
- 根 `package.json` scripts 收口为：`dev`（docs + dev-server 双起）、`dev:docs`、`dev:server`、`dev:studio`（= `pnpm -C packages/dev-server studio`）；删除 `dev:mock`、`dev:mastra`、`dev:all`（三服务全家桶不再存在）
- 项目 `CLAUDE.md`（ai-chat-ui）：包清单、`pnpm dev:mastra` 说明、架构图同步

## 7. 验收标准

### 功能（FR）

- FR1 无任何 MASTRA_* env 启动 dev-server：mock 三剧本会话正常，`/api/models` 仅含 mock 模型（现状行为回归）
- FR2 配 `MASTRA_MODEL` 启动：`/api/models` 列出 `chat-agent`（含工具与记忆描述）；对话中「问时间/天气」触发工具调用，流式 text/tool_call/tool_result chunk 线协议输出正确，前端 ToolCallPanel 正常渲染
- FR3 `MASTRA_MODEL` + `MASTRA_MODEL_URL` + `MASTRA_MODEL_API_KEY`（OpenAI 兼容端点）注册成功并可会话
- FR4 `MASTRA_TOKEN` 设置时 `/api/chat`/`/api/models` 需 Bearer（`/health` 公开）
- FR5 dev-server 包内 `pnpm studio`（mastra studio）：Studio 可见 `chat-agent`，可直接对话并观察工具调用；`mastra build`/`mastra start` 脚本存在且可执行
- FR6 `/api/providers` 运行时注册：表单注册的真实模型进入同一 registry 并可会话（spec 11 行为回归）
- FR7 conversations 会话路由行为不回归
- FR8 **新增 agent 演示口径**：在 `src/agents/` 新增一个最小定义文件 + 注册表数组加一行（含独立 instructions 与 0 工具），重启后 `/api/models` 出现该 agent 且可对话——验收「配置化注册」成立

### 非功能（NFR）

- NFR1 `@toimc/server` 主入口 dist 体积不因 mastra 增长（`/mastra` 独立子路径产物，optional peer）
- NFR2 全量 `pnpm test` / `pnpm type-check`（含 dev-server）/ `pnpm lint` 三绿；新增测试遵循红灯先行纪律
- NFR3 mock 纯模式启动时间与依赖面不劣化（不加载 @mastra/core）
- NFR4 Studio 静态导出保持 spec 12 §3.1 约束（静态命名导出、构建期选项为直属性）

### 手工验证清单

1. 无 env：`pnpm -C packages/dev-server dev` → playground 后端 `dev-server` 三剧本对话正常
2. 有 env：同上启动 → 模型列表含 `chat-agent`；问「北京现在几点、天气怎么样」→ 工具调用 + 流式回答正常
3. `pnpm -C packages/dev-server studio` → Studio 对话 + traces 正常
4. providers 表单注册一个真实模型 → 出现在模型列表并可对话
5. `MASTRA_TOKEN=xxx` 重启 → 无 Bearer 请求 401，前端配置 token 后正常

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| mastra CLI 对 dev-server 的 TS/workspace 导入链解析失败（jiti 加载 workspace 依赖） | 先做 FR5 冒烟（最早的实施任务之一，风险前置暴露）；失败则 Studio 入口改为不依赖 `@toimc/*` 的本地构建函数（定义文件保持只依赖 @mastra/* 与 zod，天然两栖） |
| 双入口 import 图意外耦合（服务入口加载 Studio 模块导致纯 mock 模式崩） | `src/index.ts` 与 `src/mastra/index.ts` 互不 import 写进测试：纯 mock 启动用例（无 env 冒烟）在 CI 跑 |
| `chat-agent` 改名破坏前端/文档引用遗漏 | 全仓 grep `mastra-agent` 收口；docs 六文件逐个过 |
| mock-server 改名遗漏引用（docs/脚本/CI） | 全仓 grep `mock-server` 收口清单化处理 |
| registerRuntimeProvider 迁移后行为漂移 | 其测试（register.test.ts）随迁并对齐断言 |

## 9. 执行顺序

遵守项目 git-flow-worktree 规则：主目录 dev 直接提交本 spec（docs-only），实施开 worktree `feat/server-mastra-integration`（基于 dev）。

1. **P1** `@toimc/server` `/mastra` 子路径 + 测试（红灯先行；含最小 in-repo 冒烟）
2. **P2** mock-server → dev-server：git mv 改名、目录重组（agents/tools/memory 收敛、注册定义驱动化、env 统一、Studio 静态导出落位）；FR5 Studio 冒烟在此阶段验证（风险前置）
3. **P3** mastra-app 定义迁入（chat-agent/instructions/model-config 合并）后整包删除；playground 前端收敛
4. **P4** docs 站六文件 + 根 scripts + 项目 CLAUDE.md 同步
5. **P5** FR8 新增 agent 演示验证 + 全量三绿 + 手工清单过一遍
6. 合并回 dev（PR），删除 worktree 与分支

> 课程 16 章三节笔记重写（01 架构解读+本次重构 / 02 组件库 AI 助手 / 03 通用 Agent 架构）不在本 spec 范围，另行会话执行。
