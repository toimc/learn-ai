---
name: tidy
description: 本地垃圾清理与上下文收敛。清理项目过程文件（.temp/截图/日志/worktree 残留）与 ~/.claude 会话垃圾（telemetry/shell-snapshots/paste-cache/旧会话），安全项直删、危险项列清单确认。审计 CLAUDE.md 与 rules，把任务型规范外置到 skill 按需加载以压缩常驻上下文。触发：/tidy、"清理垃圾"、"清理临时文件"、"清理磁盘"、"释放空间"、"上下文优化/压缩上下文"、"收敛规则"。
---

# /tidy — 本地垃圾清理与上下文收敛

三种模式，按用户意图路由。详细规则**不常驻本文件**，用到才读对应外置规则：

| 模式 | 触发 | 动作 |
|------|------|------|
| 清理（默认） | `/tidy`、"清理垃圾/临时文件/磁盘" | 读 [rules/cleanup-rules.md](rules/cleanup-rules.md) → 跑 `scripts/scan.sh` → A 级直删 → B 级列清单等确认 |
| 只扫描 | `/tidy scan` | 只跑 `scripts/scan.sh` 出报告，不删任何文件 |
| 上下文收敛 | `/tidy context` | 读 [rules/context-rules.md](rules/context-rules.md)，审计常驻上下文，出迁移方案获确认后执行 |

## 安全红线（任何模式不可违反）

1. 永不删除：`.git`、`.env*`、`node_modules`、`~/.claude/{plugins,skills,memory,settings*,CLAUDE.md,learnings-backups}`、`~/.claude/projects/*/memory/`
2. 删除只用明确路径，禁止 glob 扫射；`rm -rf` 目标必须与扫描报告逐字一致
3. B 级目标（旧会话/file-history/未追踪文件/dist）必须先列清单（路径+体积+年龄）获用户明确同意
4. worktree 清理只走 `git worktree remove` / `git worktree prune`，禁止直接 rm -rf worktree 目录
5. `scripts/scan.sh` 是只读的；任何时候不得向其中加入删除类命令

## 执行要点

- 扫描一律先跑 `bash scripts/scan.sh`（只读、确定性输出），不要自己零散跑几十条 `du`/`find`
- 每次清理结束输出报告：删除清单（路径/体积/级别）→ 释放总量 → 跳过项及原因
- 用户全局规范「删除文件前必须确认」以 B 级清单的形式兑现；A 级直删即视为已授权
