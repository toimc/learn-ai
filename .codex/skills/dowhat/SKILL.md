---
name: dowhat
description: 只读回顾当前项目工作上下文，汇总分支、worktree、近期提交、未提交改动、相关文件、Issue/PR 和下一步。用户输入“/dowhat”“当前进度”“上次做到哪了”“我之前做了什么”“catch me up”或要求总结项目工作时使用。
---

# Dowhat

只执行读取和查询操作，不修改文件、不提交、不 push。

## 收集信息

尽量并行获取：

```bash
git status --short --branch
git branch --show-current
git worktree list --porcelain
git log --oneline --decorate -15 --date=short
git diff --stat
git diff --cached --stat
git ls-files --others --exclude-standard
```

根据当前对话确定“本次会话”的起点，不把所有近期提交误写成本次会话成果。必要时用 `git show --stat <commit>` 或 `git diff <base>...HEAD --stat` 定位变更范围。

若 `gh` 已安装且认证可用，再读取：

```bash
gh issue list --limit 20
gh pr list --limit 20
```

GitHub 不可用时直接说明，不把网络或认证失败当作项目阻塞。

## 分析重点

- 当前分支属于 `master`、`dev`、feature、fix 还是 chore。
- 当前是否在独立 worktree 中，以及基线和目标分支。
- 未提交、已暂存和未跟踪文件分别有哪些。
- 变更涉及 `core`、`vue`、`markdown`、`playground`、`docs` 中哪些包，以及可能受影响的下游包。
- 从对话、提交、diff、TODO 和 Issue 中识别已完成、进行中和待处理事项。
- 检查最近验证记录；无法证实测试通过时，不推断通过。

## 输出格式

第一段用 1-2 句话给出当前状态和最合理的下一步。随后按需要使用这些小节：

- 当前状态
- 本次会话成果
- 未提交改动
- 关联文件与影响范围
- Issue / PR
- 待处理事项

工作区干净且本次会话没有代码变更时，明确写“当前工作区干净，本次会话无代码变更”。只保留高信号信息，不罗列无关历史。
