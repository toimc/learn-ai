---
name: dependency-updater
description: 检查、诊断并安全更新当前项目的 pnpm workspace 依赖。用户提出“更新依赖”“检查过期包”“修复依赖冲突”“依赖安全审计”“update dependencies”或类似请求时使用；自动处理兼容的 patch/minor 更新，major 更新必须逐项获得用户确认。
---

# Dependency Updater

## 原则

- 先读取根目录与各 workspace 的 `package.json`、`pnpm-workspace.yaml` 和 `pnpm-lock.yaml`。
- 遵守 `.codex/rules/git-flow-worktree.md`，所有写操作在独立 worktree 中完成。
- 固定版本和 peer dependency 约束可能是有意设计，不擅自放宽。
- patch/minor 可以在确认更新范围后统一应用；major 必须列出破坏性风险并逐项询问用户。
- 不删除 `node_modules`、lockfile 或缓存来“重置”环境，除非用户明确批准具体删除目标。
- 始终保留并提交 `pnpm-lock.yaml` 的相关变更。

## 流程

1. 检查工作区、Node/pnpm 版本和现有未提交改动。
2. 运行 `pnpm outdated -r` 获取过期依赖；如需更清晰的 semver 分类，可临时使用 `pnpm dlx taze -r`，不要全局安装工具。
3. 按 patch、minor、major、固定版本、peer dependency 分类，说明受影响的 workspace。
4. 在获得更新范围后修改清单并运行 `pnpm install`。
5. major 更新逐项确认，并查看迁移说明、类型变化和构建工具兼容性。
6. 运行安全审计：`pnpm audit`。不要自动使用强制修复。
7. 运行完整验证：

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

8. 检查 diff，确保没有无关格式化、生成文件或敏感信息，按依赖类别拆分中文 Conventional Commits。

## 项目注意点

- Node.js 必须满足 `^22.18.0 || >=24.12.0`，pnpm 必须满足根配置并优先使用 Corepack。
- Vue、`@vitejs/plugin-vue`、`vue-tsc` 和 TypeScript 的升级要一起检查兼容性。
- Vite、Vitest、jsdom 和测试工具可能存在 Node 引擎联动。
- `@ai-chat/vue` 与 `@ai-chat/markdown` 的 Vue peer dependency 不应无理由偏离根 Vue 版本。
- 工作区内部依赖保持 `workspace:*`。
- Markdown 相关升级需要重点验证 Shiki、KaTeX、markdown-it、DOMPurify 与 Mermaid 的浏览器和 SSR 行为。

## 输出

先给结论，再列出：已更新依赖、跳过的 major/固定版本、安全审计结果、验证命令结果和剩余风险。若检查模式没有获得写入授权，只报告建议，不修改文件。
