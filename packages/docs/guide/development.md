# 开发指南

本篇面向参与 ai-chat-ui 组件库本身开发的贡献者：了解 Monorepo 结构、常用命令、编码规范与分支模型。如果你只是想在宿主应用中使用组件库，请从 [快速开始](/guide/getting-started) 读起。

## 项目结构

pnpm workspace 管理的 Monorepo，包之间用 `workspace:*` 引用，依赖方向单一，一条架构主线贯穿始终：

```
宿主应用 → @toimc/vue (UI 组件) → @toimc/core (composables) → ChatAdapter 接口 → 用户实现
```

组件与 AI 后端完全解耦：`core` 只定义接口与状态逻辑，后端对接由宿主通过实现 `ChatAdapter` 完成。

| 包 | 职责 | 依赖 |
|----|------|------|
| `@toimc/core` | 核心类型（`Message` / `StreamChunk` / `ChatAdapter`）与 `useChat` 等 composables | **零外部依赖**，纯 TypeScript |
| `@toimc/vue` | UI 组件与依赖 Vue 的 composables | 依赖 `core`，peer 依赖 `vue ^3.5.0` |
| `@toimc/markdown` | Markdown 流式渲染（markdown-it + DOMPurify，Shiki / KaTeX / Mermaid 按需懒加载） | 依赖 `vue` |
| `playground` | 私有演示包，承载 Playground 页面与 mock 数据，每个功能一个独立 Demo 组件 | 依赖上述三个包 |
| `agents` | 服务端模型适配层（多协议适配器 + 可选 `/mastra` 子路径） | **零外部依赖**（原生 fetch） |
| `server` | Hono 聊天网关（+ 可选 `/mastra` 子路径） | 依赖 `agents` |
| `dev-server` | 私有 dev 服务：mock 剧本 + mastra agents（env 门控）+ MCP 工具适配（context7 外部库文档，`CONTEXT7_API_KEY` 门控）+ Studio 宿主 | 依赖 `core` / `agents` / `server` / `@modelcontextprotocol/sdk`（MCP 客户端） |
| `docs` | VitePress 文档站（本站） | 依赖上述三个包与 `playground` |

## 常用命令

> 本仓库的 pnpm 由 corepack 托管，以下命令均可通过 `corepack pnpm <command>` 调用。

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 同时启动文档站（VitePress 5173）与 dev-server（8787） |
| `pnpm dev:docs` / `pnpm dev:server` | 只启动文档站 / 只启动 dev-server |
| `pnpm dev:studio` | 启动 Mastra Studio（4111，需 `packages/dev-server/.env` 配置 `MASTRA_MODEL`） |
| `pnpm build` | 构建所有包 |
| `pnpm test` | 运行全部测试（Vitest，从根目录覆盖所有包） |
| `pnpm test:watch` | 测试监听模式 |
| `pnpm lint` | ESLint 检查 |
| `pnpm type-check` | vue-tsc 类型检查（core / vue / markdown） |
| `pnpm clean` | 清理所有包的 dist |

在 worktree 或全新环境中跑 `pnpm type-check` 前，需先 `pnpm build` 出 `core` 的 dist（类型检查消费构建产物）。

dev-server 的全部环境变量（`MASTRA_MODEL` 模型门控、`CONTEXT7_API_KEY` 外部库文档工具等）见 [Mastra 集成](/guide/mastra#dev-server本仓库的完整示例) 的 env 表；context7 工具由 `src/mcp/` 的 stdio 适配层在启动时动态发现，key 缺失或连接失败自动降级，不影响启动。

## 编码规范

完整规则见仓库 `.claude/rules/` 目录，以下是日常开发最高频的要点。

### TypeScript

- 全程保持 strict 模式；**禁止 `any`**，拿不准类型用 `unknown` + 收窄
- **导出类型即公共 API**：跨包使用的类型（`Message` / `StreamChunk` / `ChatAdapter` 等）从 `@toimc/core` 统一导出，其他包 re-export，不各自复制定义
- **`core` 零依赖红线**：不向 core 引入任何运行时依赖
- 流式输出统一 `AsyncGenerator<StreamChunk>`（`async *function` + `yield`），网络类操作必须支持 `AbortSignal`
- 异步操作一律 `try-catch`，catch 中抛出面向用户可读的错误信息，不吞错

### Vue 组件

- 一律 Composition API + `<script setup lang="ts">`，不写 Options API
- 状态管理只用 `provide/inject` + composable，**不引入 Pinia**；injection key 导出为 `InjectionKey<T>` 常量
- **禁止直接修改 props**：子组件要改值就 `emit` 上抛，双向绑定用 `defineModel`
- `v-for` 绑定稳定唯一的业务 id 作 `:key`，禁止用 index
- 重组件（Shiki / KaTeX / Mermaid）动态 `import()` 懒加载，不进主 chunk
- 组件内不硬编码文案，统一走 i18n `t()`（字典在 `packages/vue/src/locales/`，中英双语同步）

### 样式隔离

- 所有类选择器必须以 `.ai-chat-` 前缀开头（BEM 可用 `__` / `--` 扩展）
- 所有库样式写进 `ai-chat-*` 级联层（`@layer`），层顺序只在 `tokens.css` 顶部声明一次；**严禁写未分层规则**
- 禁止在组件内使用 `:root`、`*`、裸 `body`/`html`/裸元素选择器（仅 `tokens.css` 既定位置允许），禁止 `!important`
- 颜色、圆角、动效一律引用 `--ai-chat-*` 变量，不硬编码色值
- 第三方 CSS 走包的可选子路径导出（如 `@toimc/markdown/katex.css`），由宿主显式 import，禁止库代码隐式注入

## 文档部署（GitHub Pages）

文档站随 `master` 分支自动部署：<https://toimc.github.io/learn-ai/>（GitHub Actions `Deploy Docs` workflow，官方 `deploy-pages` 三件套，仅用内置 `GITHUB_TOKEN`，无需配置任何 secret）。

**mock 页面开关**：`/mock-server-demo` 与 `/mock-api` 依赖本地 dev-server（`pnpm dev` 同时启动，端口 8787），静态站点不可用。发布构建通过 `DOCS_TARGET=pages` 环境变量在构建期剔除这两个页面（`srcExclude` + 导航过滤 + `ignoreDeadLinks` 精确豁免 + theme 条件注册避免 Scalar 进产物），并设置 `BASE_PATH=/learn-ai/` 资源前缀。

本地开发不受影响：`pnpm dev` 与普通 `pnpm -C packages/docs build` 不设这两个变量，mock 页面照常可用。需要本地预览发布版效果时：

```bash
DOCS_TARGET=pages BASE_PATH=/learn-ai/ corepack pnpm -C packages/docs build
corepack pnpm -C packages/docs preview
```

## Git 分支模型

标准 Git Flow：

| 分支 | 角色 |
|------|------|
| `master` | 生产分支，只接收合并与发版，不写业务代码 |
| `dev` | 集成分支，所有 feature 的合并目标 |
| `feat/*` | 新功能，从 `dev` 开 |
| `fix/*` | 紧急修复（hotfix），从 `master` 开 |

- feature 完成后合回 `dev`；`dev` 领先 `master` 时合并到 `master`，做一次集中 bump 发版
- hotfix 合并 `master` 发布后，反向同步回 `dev`
- 开发在 worktree（`.claude/worktrees/<分支名>`）中隔离进行，主目录只做合并与发版
- 提交信息使用中文 Conventional Commits：`feat(scope): 描述`、`fix(scope): 描述`，subject 不超过 59 字

## 下一步

了解项目结构后，请继续阅读 [测试指南](/guide/testing)——组件库的单元测试、组件测试与集成测试如何分层组织、如何编写与运行。
