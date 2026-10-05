---
name: feature-workflow
description: 复杂功能三阶段开发工作流（调研→需求规格→实施计划→执行）。涉及多文件改动、技术选型不确定、需要调研支撑的功能统一走此流程，沉淀可复用的 spec/plan 文档，避免直接上手返工。触发：/feature-workflow、启动复杂功能/新功能开发、"三阶段流程"、写调研报告/spec/实施计划前的流程确认。
---

# /feature-workflow — 复杂功能开发工作流（三阶段产出）

> 2026-10-05 从项目 CLAUDE.md 外置（上下文收敛），内容原样承接；沉淀状态更新在本文件维护。

涉及多文件改动、技术选型不确定、需要调研支撑的功能，统一走此流程：

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
- 执行阶段严格遵守 [Git Flow + Worktree 规则](../../../rules/git-flow-worktree.md)：基于 `dev` 开 worktree

## 当前已沉淀

- `docs/01-Vue生态大模型实时流Markdown渲染方案调研.md`（Phase 调研）
- `docs/superpowers/spec/01-Markdown渲染组件需求-20260618.md`
- `docs/superpowers/plans/01-Markdown渲染组件实施计划-20260618.md`

## 实施状态

`@toimc/markdown` 流式渲染组件已实现并 `--no-ff` 合并至 `dev`（merge `d0dd151`）。5 阶段全部完成（解析内核 markdown-it+DOMPurify → Shiki 流式高亮 → KaTeX 公式 → Mermaid 沙箱图表 → 集成 + provide/inject 接入）。88/88 测试通过，markdown 包覆盖率 95/81/90/97，docs SSR 构建零警告。后续可优化项：流式增量着色（当前每块全量重挂载）、DOMPurify svg 白名单实为空操作可移除。
