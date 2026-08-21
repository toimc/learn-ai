# ai-chat-ui 项目规范

## 项目概览

AI 聊天界面组件库 Monorepo，基于 Vue 3.5+ / TypeScript 5.x / Vite 6.x / pnpm workspace。

## 架构

Provider 抽象层模式：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端。

```
用户代码 → @ai-chat/vue (UI) → @ai-chat/core (composables) → ChatAdapter 接口 → 用户实现
```

## 包依赖关系

- `core` — 无外部依赖，纯 TypeScript，定义所有核心类型和 composables
- `vue` — 依赖 `core`，peer 依赖 `vue ^3.5.0`
- `markdown` — 依赖 `vue`，使用 Shiki + KaTeX
- `playground` — 私有演示包，承载 Playground 页面与 mock 数据，依赖上述三个包
- `docs` — VitePress 文档站，依赖上述三个包与 `playground`

## 常用命令

```bash
pnpm dev          # 启动 docs（VitePress 文档站 + Playground）
pnpm build        # 构建所有包
pnpm test         # 运行全部测试
pnpm test:watch   # 监听模式
pnpm lint         # ESLint 检查
pnpm type-check   # vue-tsc 类型检查
pnpm clean        # 清理所有 dist
```

## 核心类型（@ai-chat/core）

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

## 目录约定

```
packages/<pkg>/src/     ← 源码
packages/<pkg>/dist/    ← 构建产物（不提交）
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

> ⚠️ **本节已升级为 Git Flow + Worktree 规则**。开发新功能前**必读**：[`.claude/rules/git-flow-worktree.md`](.claude/rules/git-flow-worktree.md)。
> 下方旧的「从 master 创建功能分支 / 合并到 master」描述已**废弃**，改为：所有任务开 worktree 隔离；feature 从 `dev` 开、合 `dev`；`dev` 领先 `master` 则合 `master` + 单一 bump 发版；hotfix 从 `master` 开、合 `master` 后回流 `dev`；主目录只做合并/发版，生产部署用 `.claude/run/deploy.lock` 文件锁互斥。

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能开发 | `feat/phase-{N}-{描述}` | `feat/phase-1-chat-adapter` |
| Bug 修复 | `fix/{描述}` | `fix/stream-abort-race` |
| 维护配置 | `chore/{描述}` | `chore/update-deps` |

- 功能开发按 Issue #1 的阶段划分，每个阶段拆为独立分支
- 一个阶段内如有多个子任务，可拆分子分支：`feat/phase-1-01-chat-adapter`
- 分支名用英文短横线，简洁描述核心内容

### 开发工作流

```
1. 检查 GitHub Issues → 确认当前阶段任务
2. 从 master 创建功能分支
3. 开发 → 提交（Conventional Commits 中文 subject）
4. 推送到远端 → 创建 PR（关联 Issue、填写摘要和测试计划）
5. 确认无误后合并到 master → 删除功能分支
```

### AI 协作职责

- **开发前**：检查 `gh issue list` 和 `gh issue view` 确认当前任务
- **开发中**：在功能分支上提交，不直接提交到 master
- **开发后**：
  1. 推送功能分支到远端
  2. 用 `gh pr create` 创建 PR，PR body 包含：
     - Summary：1-3 句变更摘要
     - Related Issue：`Closes #N` 或 `Part of #N`
     - Test plan：验证清单
  3. 合并 PR 后用 `gh pr merge` 合并并删除远端分支
  4. 本地切换回 master 并拉取最新代码
- **每个阶段完成后**：更新 Issue #1 的 checklist，勾选已完成项

## Git 提交规范
使用 Conventional Commits 格式
commit message 使用中文 subject
subject 不超过 59 字
body 说明”为什么改”而非”改了什么”
scope 使用模块名（button、input、theme、docs）
当用户要求提交代码的时候，尽可能只提交当前会话中相关的功能代码或者文件

## 测试与临时文件管理规范

**所有测试生成的临时文件（截图、日志、测试输出）必须统一管理，避免污染项目根目录。**

### 临时文件存放规则

- **统一存放位置**：所有测试生成的临时文件必须放在 `.temp/` 目录下
- **禁止在根目录生成**：测试截图、日志等文件严禁直接在项目根目录创建
- **测试后清理**：测试完成后必须清理 `.temp/` 目录中的临时文件
- **已加入 .gitignore**：`.temp/` 目录及常见图片格式（`*.png`、`*.jpg`、`*.jpeg`）已加入 .gitignore

### Playwright/浏览器测试规范

使用 Playwright MCP 工具进行浏览器测试时：

```bash
# 正确做法：指定 .temp 子目录
mcp__playwright__browser_take_screenshot filename=”.temp/test-scenario-1.png”

# 错误做法：直接在根目录生成
mcp__playwright__browser_take_screenshot filename=”screenshot.png”
```

### 测试流程要求

1. **测试前**：确保 `.temp/` 目录存在（`mkdir -p .temp`）
2. **测试中**：所有截图和临时文件输出到 `.temp/` 子目录
3. **测试后**：清理临时文件（`rm -rf .temp/*` 或根据需要保留）
4. **提交前**：确认根目录没有残留的测试文件

### AI 行为约束

**当 AI 被要求进行浏览器测试或生成临时文件时，必须：**

1. 自动使用 `.temp/` 目录作为输出路径
2. 测试完成后主动清理临时文件
3. 不得在项目根目录生成测试截图或日志

## 复杂功能开发工作流（三阶段产出）

> 涉及多文件改动、技术选型不确定、需要调研支撑的功能，统一走此流程，沉淀可复用的 spec / plan 文档，避免直接上手导致返工。

```
/local-search（调研）  →  /superpowers:brainstorming（需求）  →  /superpowers:writing-plans（计划）  →  执行
```

| 阶段 | 命令/技能 | 产出 | 输出目录 |
|------|-----------|------|----------|
| 1. 市场技术栈调研 | `/local-search` | 竞品/方案对比调研报告 | `docs/01-xxx.md` |
| 2. 需求规格 | `/superpowers:brainstorming` | 完整 spec（FR/NFR/架构/验收） | `docs/superpowers/spec/` |
| 3. 实施计划 | `/superpowers:writing-plans` | TDD + bite-sized 任务计划 | `docs/superpowers/plans/` |

**命名约定**：`docs/` 与 `docs/superpowers/{spec,plans}/` 下文件统一为 `01-中文名-8位日期.md`（如 `01-Markdown渲染组件需求-20260618.md`）。序号按同目录内顺序递增。

**关键纪律**：
- brainstorming 阶段必须先出设计并获用户批准，再写 spec；未经批准不进入实现
- spec 自审通过后请用户复核，复核通过才进入 writing-plans
- 计划写完提供执行选择（subagent-driven / inline），确认后再开工
- 执行阶段严格遵守 [Git Flow + Worktree 规则](.claude/rules/git-flow-worktree.md)：基于 `dev` 开 worktree

**当前已沉淀**：
- `docs/01-Vue生态大模型实时流Markdown渲染方案调研.md`（Phase 调研）
- `docs/superpowers/spec/01-Markdown渲染组件需求-20260618.md`
- `docs/superpowers/plans/01-Markdown渲染组件实施计划-20260618.md`

**实施状态**：`@ai-chat/markdown` 流式渲染组件已实现并 `--no-ff` 合并至 `dev`（merge `d0dd151`）。5 阶段全部完成（解析内核 markdown-it+DOMPurify → Shiki 流式高亮 → KaTeX 公式 → Mermaid 沙箱图表 → 集成 + provide/inject 接入）。88/88 测试通过，markdown 包覆盖率 95/81/90/97，docs SSR 构建零警告。后续可优化项：流式增量着色（当前每块全量重挂载）、DOMPurify svg 白名单实为空操作可移除。