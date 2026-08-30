# ai-chat-ui 项目指南

## 项目定位

`ai-chat-ui` 是后端无关的 AI 聊天界面组件库 Monorepo。组件通过 `ChatAdapter` 接口消费 `AsyncGenerator<StreamChunk>`，不直接绑定任何模型服务或 API。

核心调用链：

```text
用户应用 -> @toimc/vue -> @toimc/core -> ChatAdapter -> 用户实现的 AI 后端
                         \
                          -> @toimc/markdown
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

- `packages/core`：`@toimc/core`，核心类型、`ChatAdapter`、`useChat` 和工具函数；不依赖其他工作区包。
- `packages/vue`：`@toimc/vue`，Vue 组件、composables、Design Token；依赖 `core`，可选依赖 `markdown`，peer 依赖 Vue。
- `packages/markdown`：`@toimc/markdown`，Markdown、代码高亮、公式和 Mermaid 渲染；依赖 `core`、`vue`。
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
- 项目通过 `.codex/hooks.json` 自动提示并检查文档同步。若确认无需更新，运行 `python3 .codex/hooks/documentation_sync.py acknowledge --reason "具体原因"` 记录本次判断。
- 提交前可手动运行 `python3 .codex/hooks/documentation_sync.py check`；公开代码变化没有对应文档或豁免理由时，不得结束任务。

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

<claude-mem-context>
# Memory Context

# [ai-chat-ui] recent context, 2026-08-12 9:59pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 0 obs (0t read) | 0t work

**Investigated**: 通过 Playwright 自动化测试和浏览器控制台分析，深入调查了 MermaidBlock 组件中的 iframe sandbox 配置问题。检查了从 allow-same-origin 到 allow-scripts allow-same-origin 再到仅 allow-scripts 的三种配置效果，验证了每种方案对 Mermaid 图表渲染和安全性的影响。

**Learned**: 了解到浏览器向 sandbox iframe 注入脚本的机制，以及 allow-same-origin 与 allow-scripts 组合会导致"can escape its sandboxing"警告的原因。掌握了通过移除 allow-same-origin 使 iframe 变为 opaque origin 来增强隔离的技术方案，同时确认 Mermaid 静态 SVG 不依赖同源策略。

**Completed**: 完成了 MermaidBlock 组件安全策略的三次迭代优化，最终确定使用 `sandbox="allow-scripts"` 的配置。进行了完整的构建-测试-验证循环，包括重新构建 markdown 包、重启 VitePress 开发服务器、Playwright 自动化测试验证。所有修改已提交到 git（三个 commit：0bc5e0f 最终方案，c7e8990 添加 allow-scripts，6cf0455 已回退的错误方案）。

**Next Steps**: 用户需要在浏览器中手动验证最终效果：访问 http://localhost:5173/playground.html 刷新页面，确认 blocked script 告警已彻底消失。之后应该回到原始任务：分析项目依赖包的更新需求，按照语义化版本规则制定依赖升级计划。
</claude-mem-context>
