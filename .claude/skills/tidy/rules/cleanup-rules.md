# 垃圾清理规则（外置，仅 /tidy 清理模式加载）

> 本文件不进常驻上下文。安全分级的判定标准：**数据是否可再生**——可再生（遥测、缓存、快照）直删；不可再生（会话历史、编辑历史）或影响功能（构建产物）必须确认。

## A 级：安全直删

| 目标 | 理由 | 命令要点 |
|------|------|----------|
| `<proj>/.temp/` 下内容 | 项目规范钦定的临时区，gitignore 已覆盖 | `rm -rf <proj>/.temp/*` |
| `<proj>/.playwright-mcp/` | Playwright MCP 运行残留 | `rm -rf <proj>/.playwright-mcp` |
| `~/.claude/telemetry/` 内容 | 遥测数据，纯垃圾，常年是体积大头 | `rm -rf ~/.claude/telemetry/*` |
| `~/.claude/shell-snapshots/` 中 mtime>7 天 | 旧会话 shell 快照，自动重建 | `find ~/.claude/shell-snapshots -type f -mtime +7 -delete` |
| `~/.claude/paste-cache/` 内容 | 粘贴缓存 | `rm -rf ~/.claude/paste-cache/*` |

执行后逐项记入报告（路径 + 体积取自 scan 输出）。

## B 级：需确认（列清单：路径/体积/年龄 → 用户同意 → 删）

| 目标 | 风险 | 默认建议 |
|------|------|----------|
| `~/.claude/projects/**/*.jsonl` mtime>90 天 | 会话历史不可再生 | 按项目列 top 体积，建议删 90 天前 |
| `~/.claude/file-history/` mtime>30 天 | 失去对应时间点的 rewind 能力 | 删 30 天前 |
| `~/.claude/jobs/` 已完成任务 | 后台任务记录 | 体积小可跳过 |
| `~/.claude/history.jsonl` | 全局命令历史 | 建议跳过 |
| `<proj>/packages/*/dist/` | 可再生但重构建耗时 | 问用户是否顺带清 |
| git 未追踪的散落截图/日志 | 可能是用户放的资料 | 逐个列出确认 |
| 已合并 worktree（`<proj>/.claude/worktrees/`） | 须走 git 命令 | 见下方专节 |

## C 级：永不删除（红线，与 SKILL.md 一致）

`.git`、`.env*`、`node_modules`、`~/.claude/{plugins,skills,learnings-backups,backups,settings*,CLAUDE.md,plans,tasks,session-env}`、`~/.claude/projects/*/memory/`

## projects 清理的特别保护

会话目录里的 `memory/` 子目录是持久记忆（MEMORY.md 及记忆文件）。**只删 `*.jsonl` 会话文件，绝不碰 memory/**。find 必须带 `-not -path '*/memory/*'`：

```bash
find ~/.claude/projects -name '*.jsonl' -mtime +90 -not -path '*/memory/*' -delete
```

## worktree 清理专节

1. `git worktree list` 取清单；对每个 `.claude/worktrees/<name>`
2. 判断已合并：其分支出现在 `git branch --merged dev`（或 master，视基点而定）输出中
3. 已合并：`git worktree remove <path>` → `git branch -D <branch>`（规范要求 -D）
4. 目录存在但 git 已不认（孤儿）：`git worktree prune` 后手动移除目录前先 `ls` 确认为空壳
5. 未合并：报告中标注「有未合并工作」，不动

## 删除执行规范

1. 只用明确路径，禁止 glob 扫射；`rm -rf` 参数与 scan 报告逐字核对
2. 删目录前 `ls` 一眼内容，与预期不符立即停
3. find 批量删除优先 `-delete`，不用 `-exec rm`
4. 删除过程任一路径报错（不存在/权限），记录后继续，不中断整个流程

## 清理报告格式

```
## /tidy 清理报告

### 已删除（A 级直删）
- `<路径>` — <体积>
小计：释放 <总量>

### 待确认（B 级）
| 路径 | 体积 | 年龄 | 建议 |
（用户确认后执行，追加进已删除小节）

### 跳过
- `<路径>` — <原因>（如：含未合并分支 / 用户拒绝 / 红线）
```
