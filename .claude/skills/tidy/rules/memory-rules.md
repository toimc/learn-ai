# 记忆压缩与清理规则（外置，仅 /tidy memory 模式加载）

> 管各 AI CLI 的记忆与会话数据。记忆是**不可再生**数据：所有删除/合并/改索引操作一律先出方案、逐条获用户确认后执行，无任何直删项。

## 数据源矩阵

| 工具 | 位置 | 类型 | 操作 |
|------|------|------|------|
| Claude auto-memory | `~/.claude/projects/<proj>/memory/`（MEMORY.md 索引 + 单条 .md） | 内容型记忆 | 完整性检查 + 内容压缩 |
| claude-mem | `~/.claude-mem/{logs,claude-mem.db,chroma,...}` | 日志 + 记忆库 + 向量索引 | 体积清理（见分级） |
| Codex | `~/.codex/{memories,sessions,*.bak,shell_snapshots,log,tmp}` | 混合 | 内容压缩(memories) + 体积清理(其余) |
| Gemini / Cursor 等 | `~/.gemini/`、`~/.cursor/` | 各类缓存 | 仅列体积，默认不动 |

## 一、完整性检查（结构性修复，低风险）

对每个 memory 目录（体积 top 项目必查，其余可选）：

1. **死链**：MEMORY.md 索引指向不存在的文件 → 从索引删该行（`scan.sh` 已自动检出）
2. **孤儿**：目录里的 .md 未进 MEMORY.md 索引 → 补一行索引（或确认无用后删除，须用户选）
3. 修复只动 MEMORY.md，不删任何记忆文件；diff 展示后执行

## 二、内容压缩（模型判断 + 逐条确认）

逐文件读 memory 目录，产出建议表：

| 文件 | 问题 | 建议 |
|------|------|------|
| `foo.md` | 与 `bar.md` 主题重叠 | 合并至 bar.md（保留双方 [[链接]]） |
| `baz.md` | 引用的文件/flag 已不存在 | 删除（删除前必须实际验证引用目标确实不存在，不能只看字面） |
| `qux.md` | 记录已被后续事实证伪 | 删除 |

- 合并 = 把内容收进目标文件 → 原文件删除 → MEMORY.md 索引同步（删旧行/改指针）
- **禁止**未经确认删任何记忆文件；单文件超 200 行的可建议内部精简，但默认不动
- Claude auto-memory 的记忆有 frontmatter（name/description/metadata），合并后 name 唯一、description 取并集语义

## 三、体积清理分级

### A 级（可再生，直删）
| 目标 | 理由 |
|------|------|
| `~/.claude-mem/logs/` 内容 | 观察者日志，可再生（实测常年 1.9G 大头） |
| `~/.codex/log/`、`~/.codex/tmp/` 内容 | 运行日志与临时区 |
| `~/.codex/shell_snapshots/` 中 >7 天 | 同 Claude 快照逻辑 |

### B 级（需确认）
| 目标 | 风险 | 默认建议 |
|------|------|----------|
| `~/.codex/sessions/**/*.jsonl` >30 天 | Codex 会话历史不可再生 | 列数量+体积，建议删 30 天前 |
| `~/.codex/*.bak*`（auth/config 备份，7 个左右） | auth 备份**含凭证**，删除反而缩小泄漏面 | 建议删（保留最新一份） |
| `~/.claude-mem/claude-mem.db` | 记忆库本体 | 只在用户明确要求时按项目清条目，不整库删 |
| `~/.claude-mem/chroma/` | 向量索引，可从 db 重建但耗时 | 体积异常大时建议重建而非删除 |
| `~/.codex/*.sqlite*`（thread_history/logs/queue 等） | 运行数据，删了丢历史 | 建议跳过；log 类 sqlite 可列出让用户定 |

### C 级（永不删）
`~/.claude/projects/*/memory/` 的**批量**删除路径（内容处理只走本文件第二节逐条确认流程）；`~/.codex/{memories/,AGENTS.md,config.toml,auth.json,sessions/近30天}`；`~/.gemini/`、`~/.cursor/`（仅探测不动）。

## 运行中进程检查（删 claude-mem 数据前必做）

```bash
pgrep -fl 'claude-mem|observer' || echo "无运行中进程，可操作"
```

有进程在跑时：`claude-mem.db-wal` 有活跃写入，先让用户停插件/观察者再动 db 相关文件；logs 清理不受影响。

## Codex memories 结构说明

`~/.codex/memories/` = `MEMORY.md`（索引）+ `raw_memories.md`（原始观察）+ `memory_summary.md`（摘要）+ `rollout_summaries/`。先读三个 md 理解当前格式再出压缩方案；只动 md 文件，不碰任何 sqlite。压缩方式同第二节（去重合并 + 过时清理）。

## 报告格式

```
## /tidy memory 报告

### 完整性
- <项目>：死链 N / 孤儿 N → 已修复（diff 见上）

### 内容压缩（已确认执行）
- 合并：foo.md → bar.md（索引已同步）
- 删除：baz.md（引用目标 /path 已不存在，已验证）

### 体积清理
- A 级直删：<清单+体积>
- B 级：<清单+体积+年龄>（等待/已确认）

### 记忆健康度
- 覆盖项目数 / 总文件数 / 总体积 / 压缩后预期
```
