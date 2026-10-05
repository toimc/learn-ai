# ai-chat-ui 项目指南

> 跨 agent 统一入口（Claude Code / Codex / Cursor 共读）。规则正文的唯一副本在 `.claude/rules/`，本文只做摘要与指向，不复制细节，防止第三份副本再生漂移。

## 项目定位

`ai-chat-ui` 是后端无关的 AI 聊天界面组件库 Monorepo。组件通过 `ChatAdapter` 接口消费 `AsyncGenerator<StreamChunk>`，不直接绑定任何模型服务或 API。

前端调用链：

```text
用户应用 -> @toimc/vue -> @toimc/core -> ChatAdapter -> 用户实现的 AI 后端
                         \
                          -> @toimc/markdown
```

服务端线（可选）：`@toimc/agents`（模型适配层）→ `@toimc/server`（Hono 网关，含可选 `/mastra` 子路径）；私有 `dev-server`（8787 端口）承载 mock 剧本与 mastra agents 演进宿主。

## 技术栈

- Vue `^3.5.41`，组件统一使用 `<script setup lang="ts">`
- TypeScript `^6.0.3`，启用严格模式
- Vite `^8.2.1`，库包输出 ESM、CJS 和类型声明
- pnpm workspace，项目声明 `pnpm@11.21.0`（本机裸 `pnpm` 可能被 asdf 拦，用 `corepack pnpm`）
- Node.js `^22.18.0 || >=24.12.0`
- Vitest `^4.1.10` + `@vue/test-utils` + jsdom；Playwright 跑 e2e
- ESLint 10 flat config + Prettier 3 + commitlint（Conventional Commits）
- VitePress `^1.6.4` 文档站
- Markdown 渲染使用 markdown-it、Shiki、KaTeX、DOMPurify；Mermaid 为可选依赖

版本信息以根目录和各包的 `package.json` 为准，文档中的旧版本描述仅作历史参考。

## 包与依赖关系

- `packages/core`：`@toimc/core`，核心类型、`ChatAdapter`、`useChat` 和工具函数；零 dependencies（peer 依赖 vue，构建 external），不依赖其他工作区包。
- `packages/vue`：`@toimc/vue`，Vue 组件、composables、Design Token；依赖 `core`，可选依赖 `markdown`，peer 依赖 Vue。
- `packages/markdown`：`@toimc/markdown`，Markdown、代码高亮、公式和 Mermaid 渲染；依赖 `core`、`vue`。
- `packages/agents`：`@toimc/agents`，服务端模型适配层（多协议适配器 + 可选 `/mastra` 子路径导出）；零外部依赖纯逻辑层。
- `packages/server`：`@toimc/server`，Hono 聊天网关（+ 可选 `/mastra` 子路径：agent 定义驱动的 `createMastraGateway`）；依赖 `agents`。
- `packages/playground`：私有演示包，提供 Playground 页面、mock adapter 和 mock messages，不发布。
- `packages/dev-server`：私有 dev 服务（8787）：mock 剧本 + mastra agents（`MASTRA_MODEL` env 门控）+ Studio 宿主，不发布。
- `packages/docs`：私有 VitePress 文档站，集成所有包与 Playground，不发布。

修改公共类型或导出时，检查所有下游包。包之间只使用 `workspace:*` 引用。

## 关键目录

```text
packages/core/src/                 核心消息、流式块和适配器类型，useChat
packages/vue/src/                  Vue 组件、样式、composables、utils
packages/markdown/src/             MarkdownRenderer、CodeBlock、LatexBlock、MermaidBlock
packages/agents/src/               模型适配器与 /mastra 子路径
packages/server/src/               Hono 网关与 /mastra 子路径
packages/dev-server/src/           mock 剧本、mastra 装配、Studio 宿主
packages/playground/src/           演示页面和 mock 数据
packages/docs/                     VitePress 文档与组件示例
e2e/                               Playwright e2e 测试
scripts/                           publish.sh 等运维脚本
docs/                              调研、需求规格、实施计划与 daydayup 日报
.claude/rules/                     项目规则唯一副本（7 个规则文件）
.claude/skills/                    项目级技能（入库副本以此为准）
.codex/hooks/                      双 agent 共用的 hook 脚本（见「配置双轨说明」）
```

构建产物 `dist/`、覆盖率目录、VitePress 缓存和临时测试文件不提交。

## 常用命令

```bash
pnpm install
pnpm dev            # 一键全家桶：docs(5173) + dev-server(8787) + Mastra Studio(4111)
pnpm dev:docs       # 只起文档站
pnpm dev:server     # 只起 dev-server（8787）
pnpm dev:studio     # 只起 Studio（4111，需 packages/dev-server/.env 配置 MASTRA_MODEL）
pnpm build
pnpm test
pnpm test:watch
pnpm test:e2e       # Playwright e2e（另有 :ui / :debug / :headed / :report 变体）
pnpm lint
pnpm lint:fix
pnpm format:check
pnpm type-check
pnpm changeset      # 创建 changeset（发版流程见 git-flow-worktree.md）
```

优先运行与改动范围匹配的测试；提交前至少运行相关测试、`pnpm type-check` 和 `pnpm lint`。公共 API、构建配置或跨包改动还要运行 `pnpm build`。覆盖率阈值目前只在根 `vitest.config.ts` 对 markdown 包配置（statements 80%、branches 75%、functions 80%、lines 80%）。

## 编码约定

- Vue 组件使用 Composition API、`<script setup>` 和 TypeScript。
- 对话实例状态使用 `provide/inject`，不要引入 Pinia。
- 样式使用 `--ai-chat-*` CSS Variables，不引入 Tailwind、UnoCSS 或其他 CSS 框架。
- 主题相关颜色必须使用 CSS Variables；跨明暗主题 hover 背景优先使用中性 `rgba(128, 128, 128, 0.15)`。
- 同一区域的按钮、输入框和列表项使用稳定的固定高度，避免仅靠 padding 撑高。
- hover 显隐优先使用 `visibility`，避免 `display` 切换引发布局跳动。
- 保持现有公开 API 和导出风格；新增导出同步更新包入口和类型声明构建。
- 测试统一放 `packages/<pkg>/__tests__/`（目录镜像 src 结构），禁止与源码混放在 `src/` 内；组件测试使用 `@vue/test-utils`。
- 优先编辑已有文件，不引入无关依赖，不做未要求的重构，不修改无关模块。
- 不确定是否仍使用的代码不要直接删除；先调查调用方，仍不确定时保留并标注 TODO。

## 工作方式

- 修改前阅读相关实现、测试、入口文件和下游调用方。
- 复杂多文件功能先明确需求、方案和验收标准；用户确认后连续执行，不重复逐步确认。
- 不主动创建新的 README、CHANGELOG 或额外设计文档，除非任务明确要求；但代码变化影响现有公开 API、组件行为、安装方式、示例或主题能力时，必须同步更新已有 README/VitePress 文档。
- 回复用户使用中文。

## 代码与文档同步

- 修改 `packages/core` 的公共类型、适配器、composable 或导出时，同步 `README.md`、`packages/docs/composables/use-chat.md` 或对应使用指南。
- 修改 `packages/vue` 的组件、props、events、slots、交互或导出时，同步 `packages/docs/components/` 下对应组件页面；必要时同时更新 README 的组件清单与示例。
- 修改 `packages/markdown` 的渲染能力、组件 API 或导出时，同步 MarkdownRenderer、CodeBlock、LatexBlock 等对应文档和示例。
- 修改安装包、peer dependency、Node/pnpm 要求或安装命令时，同步 README 和安装文档。
- 修改 Playground 用户可见流程或示例时，同步 `packages/docs/playground.md`。
- 修改 `packages/dev-server` 时按目录同步：`src/routes/**` 与 `openapi.ts` → `packages/docs/mock-api.md`；`src/rag/**`、`src/tools/**`（检索与工具行为）→ `packages/docs/guide/rag.md` 与 `packages/docs/vector-search-demo.md`；`src/memory.ts`、`src/paths.ts` → `packages/docs/guide/memory.md`；其余（agents/env/app/mastra 装配）→ `packages/docs/guide/mastra.md`。
- 纯测试、内部重构或不改变用户可见行为的修复可以不改文档，但必须明确判断原因，不能默认跳过。
- 项目通过 hooks 自动提示并检查文档同步（`.claude/settings.json` 与 `.codex/hooks.json` 双注册，脚本在 `.codex/hooks/documentation_sync.py`）。若确认无需更新，运行 `python3 .codex/hooks/documentation_sync.py acknowledge --reason "具体原因"` 记录本次判断。
- 提交前可手动运行 `python3 .codex/hooks/documentation_sync.py check`；公开代码变化没有对应文档或豁免理由时，不得结束任务。
- **hook 行为须知（每个新 agent 都会踩，先记这里）**：① `git add` 与 `git commit` 必须拆成两条命令——复合命令（`a && b`）会被 PreToolUse hook 整条拦截；② 多 agent 并行时，hook 会把其他会话未提交的 packages 源码也算进拦截范围——涉 packages 源码的任务与纯 docs 任务要串行提交；③ acknowledge 不是百分百可靠，最可靠的解法永远是补齐真实文档改动。

## Git 工作流

开始任何开发或修复前，必须先阅读 [`.claude/rules/git-flow-worktree.md`](.claude/rules/git-flow-worktree.md)（唯一副本；`.codex/rules/` 下的同名文件是过期版本，勿引用）。

摘要：

- `master` 是生产分支，`dev` 是集成分支；feature 从 `dev` 创建，hotfix 从 `master` 创建。
- 所有代码改动在 `.claude/worktrees/<分支名>/` 的独立 worktree 中完成；主工作区仅用于合并和发版。
- 开工前确认基线工作区干净；若有用户改动，先按范围提交，不覆盖或丢弃。
- 提交使用 Conventional Commits，中文 subject，不超过 59 字；body 说明修改原因。
- Changesets 已配置（`.changeset/config.json`，baseBranch `master`）：发版走 `pnpm changeset version` → `pnpm changeset publish`（或 tag 触发 `.github/workflows/publish.yml`）→ 打 tag。不要相信旧文档里「未配置 Changesets」的说法。
- feature / hotfix 合并后立即删除分支（本地 `git branch -D` + 远端 delete）。
- 功能完成并验证后自动提交，但不主动 push、创建 PR、合并远端或发布，除非用户明确要求。
- 禁止提交 `.env`、token、凭证或其他敏感信息。

## CI

- `.github/workflows/publish.yml`：tag 触发 npm 发布。
- `.github/workflows/e2e-tests.yml`：push / PR 触发 Playwright e2e（注意两处历史残留待清理：触发分支 `[main, dev]` 中的 `main` 不存在——仓库实际是 master/dev；paths 过滤器引用的 `playground.config.ts` 不存在）。
- `.github/workflows/docs-deploy.yml`：文档站部署。
- pre-commit 钩子（simple-git-hooks）：`lint-staged` + `documentation_sync.py staged`；commit-msg 跑 commitlint。

## 配置双轨说明

`.claude/` 与 `.codex/` 两侧并存，事实来源如下：

- **规则正文**：唯一在 `.claude/rules/`（7 个文件）。`.codex/rules/git-flow-worktree.md` 是过期副本，内容与 `.claude` 版有行为级冲突（发版指令、worktree 路径、删分支策略），以 `.claude` 版为准。
- **hook 脚本**：`documentation_sync.py` / `i18n_guard.py` 放在 `.codex/hooks/` 下，但被两侧共用（`.claude/settings.json` 与 `.codex/hooks.json` 各自注册，matcher 差异是工具名适配）。改名或移动需同步两处注册。
- **skills**：入库副本以 `.claude/skills/` 为准；`.codex/skills/` 下的 `dowhat` / `dependency-updater` 是滞后副本。

## 项目级 Skills

- `$i18n`：组件库国际化规范，创建/修改组件、新增 UI 文案时必读。
- `$daydayup`：项目自评审与知识沉淀循环（三轴并行审查 → 复核 → 日报到 `docs/daydayup/`），手动 `/daydayup` 或夜间定时触发。
- `$dependency-updater`：检查、分类并安全更新依赖；主要版本更新必须先获得用户确认。
- `$dowhat`：只读汇总当前分支、提交、改动、Issue/PR 和后续事项。
- `$tidy`：本地垃圾清理与上下文收敛（过程文件、会话垃圾、规则瘦身）。
- `ppt-master` 为本机符号链接，不入库，不算项目技能。

## 知识沉淀与自成长循环

- **个人 memory**：Claude 侧项目记忆在 `~/.claude/projects/.../memory/`（索引 `MEMORY.md`），存跨会话踩坑经验；满足「项目特有 + 高频踩 + 可写成可执行检查项」的才升级进 `.claude/rules/`。
- **spec / plans 归档**：复杂功能走 `/local-search → brainstorming → writing-plans` 三阶段，产出归档 `docs/superpowers/{spec,plans}/`，命名 `NN-中文名-8位日期.md`。
- **daydayup 日报**：`docs/daydayup/YYYY-MM-DD-第N期.md`，索引在 `docs/daydayup/README.md`。夜间定时任务会自动跑一轮轻量评审，有变化面才升级为完整三轴审查；改规则/AGENTS.md 这类行为契约只出建议 diff，等用户确认后合入。
