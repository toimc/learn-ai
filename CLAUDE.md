# ai-chat-ui 项目规范

## 项目概览

AI 聊天界面组件库 Monorepo，基于 Vue 3.5+ / TypeScript 5.x / Vite 6.x / pnpm workspace。

## 架构

Provider 抽象层模式：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端。

```
用户代码 → @toimc/vue (UI) → @toimc/core (composables) → ChatAdapter 接口 → 用户实现
```

## 包依赖关系

- `core` — 无外部依赖，纯 TypeScript，定义所有核心类型和 composables
- `vue` — 依赖 `core`，peer 依赖 `vue ^3.5.0`
- `markdown` — 依赖 `vue`，使用 Shiki + KaTeX
- `agents` — 服务端模型适配层（多协议适配器 + 可选 `/mastra` 子路径），零外部依赖
- `server` — Hono 聊天网关（+ 可选 `/mastra` 子路径：agent 定义驱动的 `createMastraGateway`），依赖 `agents`
- `playground` — 私有演示包，承载 Playground 页面与 mock 数据，依赖上述组件包
- `dev-server` — 私有 dev 服务（8787）：mock 剧本 + mastra agents（`MASTRA_MODEL` env 门控）+ Studio 宿主，依赖 `core`/`agents`/`server`
- `docs` — VitePress 文档站，依赖上述组件包与 `playground`

## 常用命令

```bash
pnpm dev          # 一键全家桶：docs（5173）+ dev-server（8787）+ Mastra Studio（4111）
pnpm dev:docs     # 只启动文档站
pnpm dev:server   # 只启动 dev-server（8787）
pnpm dev:studio   # 只启动 Mastra Studio（4111，需 packages/dev-server/.env 配置 MASTRA_MODEL；缺 .env 时 studio 进程报错退出，其余两个不受影响）
pnpm build        # 构建所有包
pnpm test         # 运行全部测试
pnpm test:watch   # 监听模式
pnpm lint         # ESLint 检查
pnpm type-check   # vue-tsc 类型检查
pnpm clean        # 清理所有 dist
```

## 核心类型（@toimc/core）

- `Message`：消息模型（id/role/content/attachments/metadata/createdAt）
- `StreamChunk`：流式块（type: text/tool_call/thinking/error/done）
- `ChatAdapter`：后端适配接口（sendMessage 返回 AsyncGenerator）
- `SendMessageOptions`：发送参数（messages/model/temperature/maxTokens/signal）
- `ChatOptions` / `ChatState`：useChat 的配置和返回值

## 编码规范

- 组件使用 `<script setup>` + TypeScript
- 状态管理用 `provide/inject`，不用 Pinia
- 样式用 CSS Variables（`--ai-chat-*`），不用 Tailwind
- 导出三格式：ESM (.mjs) + CJS (.cjs) + 类型声明 (.d.ts)
- 包之间用 `workspace:*` 引用

### CSS/UI 经验

- 同一区域多个交互元素（按钮/输入框/列表项）用固定 `height` 保持高度一致，不依赖 padding 撑开
- hover 显示/隐藏元素用 `visibility: hidden/visible` 而非 `display: none/flex`，避免布局跳动
- 需兼容明暗主题的 hover 背景用中性 `rgba(128,128,128,0.15)`，不用 white/black 系 rgba
- 主题相关的颜色值（focus 背景、active 状态等）必须用 CSS Variables，不硬编码具体色值

### i18n 规范

- 所有 UI 文案进 `packages/vue/src/locales/` 字典（中英双语同步更新），组件内用 `aiChatI18n.global` 的 `t()`；详见 `.claude/skills/i18n/SKILL.md`，新建/修改组件时必须遵循

## 目录约定与包结构

每个包统一结构：`src/`（纯源码，根级只留 `index.ts`/`env.d.ts`/包级 `types.ts`，按功能模块建目录，同类文件 ≥2 才成组）+ `__tests__/`（与 src 平级，内部镜像 src 目录树）。测试文件**必须**放 `__tests__/`，禁止与源码混放。完整规则见 [`.claude/rules/project-structure.md`](.claude/rules/project-structure.md)。

```
packages/<pkg>/src/          ← 源码（零测试文件）
packages/<pkg>/__tests__/    ← 测试（镜像 src 结构）
packages/<pkg>/dist/         ← 构建产物（不提交）
packages/<pkg>/vite.config.ts
packages/<pkg>/tsconfig.json
packages/<pkg>/package.json
```

### Playground 演示组织（每功能一文件）

- 每个功能演示自动创建独立组件：`packages/playground/src/components/demos/<Feature>Demo.vue`，自包含（自己的 mock、状态、`pg.<feature>` 文案 key），不往 PlaygroundDemo.vue 里堆
- 页面壳 `<Feature>DemoPage.vue` 只做布局包装；经 `packages/docs/<feature>-demo.md` 的 `layout` frontmatter 挂载
- 新演示四件套同步：`playground/src/index.ts` 导出 + `.vitepress/theme/index.ts` 全局注册 + `.vitepress/config.ts` 导航 + `playground.md` 链接

## 测试

- 单元测试用 Vitest，放在对应模块的 `.test.ts` 文件旁
- 组件测试用 `@vue/test-utils`
- `pnpm test` 从根目录跑所有包的测试

### 测试流程（防自证无效测试）

> AI 自己写实现又自己写测试时，断言容易与实现同源同错（同义反复、弱断言、"不崩即过"）。以下两条纪律强制让测试成为**第二个独立来源**：

1. **红灯先行**：每条新测试必须先失败过一次才算数。流程：写测试 → 在实现缺失或故意改错的状态下跑出红灯（证明断言真的在校验，而非实现的声音回放）→ 恢复实现转绿 → 提交。批量补测时，把红灯证据（哪条用例在什么改错下红了）简述进 commit body。
2. **双盲分工**：批量补测或新功能写测试时，用独立 subagent 编写测试——prompt 中只提供文档页与类型定义（`packages/*/src/types`、`packages/docs` 对应页），明确禁止读实现源码；测试与实现对拍通过后再合入。单条小修可不启动双盲，但预期值独立性条款永远适用。

预期值三来源（手写字面量 / 文档写明的值 / 独立第三方实现）、弱断言黑名单等细则见 `.claude/rules/frontend-testing.md` 第 2 节。


## 代码修改规范
- 不要删除你不确定是否使用的代码，先标记 TODO
- 不要重构你没有被要求重构的代码
- 不要修改你不直接相关的文件
- 每次改动只做被要求的事，不多不少
- 修改前先阅读相关文件，理解上下文
- **开始任何功能开发前，先提交当前工作区所有变更**，确保基于干净状态开发

## Git 分支管理规范

> 开发前**必读** [`.claude/rules/git-flow-worktree.md`](.claude/rules/git-flow-worktree.md)——所有任务开 worktree；feature 从 `dev` 开合 `dev`；`dev` 领先 `master` 则合 `master` 发版；hotfix 从 `master` 开回流 `dev`；主目录只做合并/发版，部署抢 `.claude/run/deploy.lock`。

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能开发 | `feat/phase-{N}-{描述}` | `feat/phase-1-chat-adapter` |
| Bug 修复 | `fix/{描述}` | `fix/stream-abort-race` |
| 维护配置 | `chore/{描述}` | `chore/update-deps` |

- 功能开发按 Issue #1 的阶段划分，每个阶段拆为独立分支；分支名用英文短横线，简洁描述核心内容
- **每个阶段完成后**：更新 Issue #1 的 checklist，勾选已完成项

## Git 提交规范
使用 Conventional Commits 格式
commit message 使用中文 subject
subject 不超过 59 字
body 说明”为什么改”而非”改了什么”
scope 使用模块名（button、input、theme、docs）
当用户要求提交代码的时候，尽可能只提交当前会话中相关的功能代码或者文件

## 临时文件红线

- 所有测试/过程产物（截图、日志、脚本）一律写 `.temp/`（已 gitignore），完成后清理，禁止落项目根目录
- Playwright MCP 截图必须指定 `.temp/` 子路径；提交前确认根目录无残留；清理可用 `/tidy`

## 复杂功能开发工作流

涉及多文件改动、选型不确定、需调研支撑的功能：先 `/feature-workflow` 查看三阶段流程（调研 → 需求规格 → 实施计划 → 执行）、命名约定与已沉淀文档索引。

<!-- 2026-10-05 上下文收敛：本节详情外置至 .claude/skills/feature-workflow/SKILL.md，触发 /feature-workflow 时加载 -->