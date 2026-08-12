# ai-chat-ui 项目指南

## 项目定位

`ai-chat-ui` 是后端无关的 AI 聊天界面组件库 Monorepo。组件通过 `ChatAdapter` 接口消费 `AsyncGenerator<StreamChunk>`，不直接绑定任何模型服务或 API。

核心调用链：

```text
用户应用 -> @ai-chat/vue -> @ai-chat/core -> ChatAdapter -> 用户实现的 AI 后端
                         \
                          -> @ai-chat/markdown
```

## 技术栈

- Vue `^3.5.41`，组件统一使用 `<script setup lang="ts">`
- TypeScript `^6.0.3`，启用严格模式
- Vite `^8.2.1`，库包输出 ESM、CJS 和类型声明
- pnpm workspace，项目声明 `pnpm@11.21.0`
- Node.js `^22.18.0 || >=24.12.0`
- Vitest `^4.1.10` + `@vue/test-utils` + jsdom
- ESLint 10 flat config + Prettier 3
- VitePress `^1.6.4` 文档站
- Markdown 渲染使用 markdown-it、Shiki、KaTeX、DOMPurify；Mermaid 为可选依赖

版本信息以根目录和各包的 `package.json` 为准，文档中的旧版本描述仅作历史参考。

## 包与依赖关系

- `packages/core`：`@ai-chat/core`，核心类型、`ChatAdapter`、`useChat` 和工具函数；不依赖其他工作区包。
- `packages/vue`：`@ai-chat/vue`，Vue 组件、composables、Design Token；依赖 `core`，可选依赖 `markdown`，peer 依赖 Vue。
- `packages/markdown`：`@ai-chat/markdown`，Markdown、代码高亮、公式和 Mermaid 渲染；依赖 `core`、`vue`。
- `packages/playground`：私有演示包，提供 Playground 页面、mock adapter 和 mock messages。
- `packages/docs`：私有 VitePress 文档站，集成所有包与 Playground。

修改公共类型或导出时，检查所有下游包。包之间只使用 `workspace:*` 引用。

## 关键目录

```text
packages/core/src/types/           核心消息、流式块和适配器类型
packages/core/src/composables/     useChat
packages/vue/src/                  六类组件、样式、composables、utils
packages/markdown/src/             MarkdownRenderer、CodeBlock、LatexBlock、MermaidBlock
packages/playground/src/           演示页面和 mock 数据
packages/docs/                     VitePress 文档与组件示例
docs/                              调研、需求规格和实施计划
.codex/skills/                     项目级 Codex skills
.codex/rules/                      详细项目规则
```

构建产物 `dist/`、覆盖率目录、VitePress 缓存和临时测试文件不提交。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:watch
pnpm lint
pnpm lint:fix
pnpm format:check
pnpm type-check
```

优先运行与改动范围匹配的测试；提交前至少运行相关测试、`pnpm type-check` 和 `pnpm lint`。公共 API、构建配置或跨包改动还要运行 `pnpm build`。Markdown 包覆盖率阈值为 statements 80%、branches 75%、functions 80%、lines 80%。

## 编码约定

- Vue 组件使用 Composition API、`<script setup>` 和 TypeScript。
- 对话实例状态使用 `provide/inject`，不要引入 Pinia。
- 样式使用 `--ai-chat-*` CSS Variables，不引入 Tailwind、UnoCSS 或其他 CSS 框架。
- 主题相关颜色必须使用 CSS Variables；跨明暗主题 hover 背景优先使用中性 `rgba(128, 128, 128, 0.15)`。
- 同一区域的按钮、输入框和列表项使用稳定的固定高度，避免仅靠 padding 撑高。
- hover 显隐优先使用 `visibility`，避免 `display` 切换引发布局跳动。
- 保持现有公开 API 和导出风格；新增导出同步更新包入口和类型声明构建。
- 测试文件与实现相邻，命名为 `*.test.ts`；组件测试使用 `@vue/test-utils`。
- 优先编辑已有文件，不引入无关依赖，不做未要求的重构，不修改无关模块。
- 不确定是否仍使用的代码不要直接删除；先调查调用方，仍不确定时保留并标注 TODO。

## 工作方式

- 修改前阅读相关实现、测试、入口文件和下游调用方。
- 复杂多文件功能先明确需求、方案和验收标准；用户确认后连续执行，不重复逐步确认。
- 不主动创建 README、CHANGELOG 或额外设计文档，除非任务明确要求。
- 回复用户使用中文。

## Git 工作流

开始任何开发或修复前，必须先阅读 [`.codex/rules/git-flow-worktree.md`](.codex/rules/git-flow-worktree.md)。该文件中的 Git Flow + Worktree 规则优先于旧文档中的分支描述。

摘要：

- `master` 是生产分支，`dev` 是集成分支。
- feature 从 `dev` 创建，hotfix 从 `master` 创建。
- 所有代码和配置改动在 `.codex/worktrees/<分支名>/` 的独立 worktree 中完成；主工作区仅用于合并和发版。
- 开工前确认基线工作区干净；若有用户改动，先按范围提交，不覆盖或丢弃。
- 提交使用 Conventional Commits，中文 subject，不超过 59 字；body 说明修改原因。
- 功能完成并验证后自动提交，但不主动 push、创建 PR、合并远端或发布，除非用户明确要求。
- 禁止提交 `.env`、token、凭证或其他敏感信息。

## 项目级 Skills

- `$dependency-updater`：检查、分类并安全更新依赖；主要版本更新必须先获得用户确认。
- `$dowhat`：只读汇总当前分支、提交、改动、Issue/PR 和后续事项。
