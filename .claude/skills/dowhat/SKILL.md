---
name: dowhat
description: 快速回顾当前项目的工作上下文。收集会话历史、git 状态、相关文件和待办事项，生成结构化摘要。触发：用户输入 /dowhat，或问"我之前做了什么"、"总结一下我们的工作"、"当前进度"、"catch me up"、"我们聊了什么"、"上次做到哪了"等回顾性问题时使用。
---

# /dowhat — 项目工作上下文回顾

快速汇总当前项目的工作状态，帮用户回忆"做了什么、改了什么、做到哪了"。

## 执行步骤

### 1. 并行收集信息

同时执行以下命令：

```bash
# 当前分支和状态
git branch --show-current
git status --short

# 近期提交（当前分支，最近 15 条）
git log --oneline --decorate -15 --format="%h %ad %s" --date=short

# 未提交的变更统计
git diff --stat HEAD

# 未跟踪文件
git ls-files --others --exclude-standard
```

同时搜索 claude-mem 记忆（如果可用）：

```
search(query="当前项目", limit=15, orderBy="date_desc")
```

### 2. 分析关联信息

根据收集到的信息，识别：

- **完成的阶段**：从 git log 和 claude-mem 提取已完成的功能/修复
- **活跃的分支**：当前分支的目标（从分支名推断）
- **文件变更范围**：哪些包/模块被修改
- **未完成的工作**：未提交变更、TODO 标记、open issues
- **关联的 Issue/PR**：用 `gh pr list` 和 `gh issue list` 检查

### 3. 输出结构化报告

**一句话摘要必须放在最前面**，让用户一眼看到核心信息：

```
> {用 1-2 句话概括当前工作状态和下一步}

## 📋 工作上下文回顾

**分支**: {branch} | **项目**: {project_name}

### 本次会话的提交
只展示与当前会话相关的 git 提交（从 claude-mem 会话时间范围内筛选，不要罗列所有近期提交）：
- `{commit_hash}` {date} — {commit_message}
- ...
（如果本次会话没有产生提交，此节省略）

### 当前工作状态
- 进行中的任务：{从 git status 和 diff 描述}
- 未提交变更：X 个文件（列出关键文件）
- 未跟踪文件：X 个（列出文件名）

### 关联文件
列出本次会话涉及的关键文件（从 diff 和 log 提取，去重，按重要性排序）：
- `path/to/key/file.ts` — {简要说明变更内容}

### 外部关联
- GitHub Issues: {列出相关的 open issue}
- Pull Requests: {列出相关的 PR}
- 影响的下游模块/包：{从 monorepo 依赖关系推断}

### 待处理事项
- [ ] {未提交的变更需要提交}
- [ ] {未完成的 TODO}
- [ ] {需要验证的功能}
```

### 4. 补充规则

- **一句话摘要放最前面**，用 blockquote `>` 格式突出显示
- **git 提交只展示与当前会话相关的**，通过 claude-mem 的会话时间范围或对话上下文判断，不要罗列全部近期提交
- 如果工作区完全干净且本次会话无提交，输出"当前工作区干净，本次会话无代码变更。"
- 如果只有 claude-mem 有记录但无代码变更，侧重总结讨论内容和决策
- monorepo 项目标注变更涉及的包名（如 `core`、`vue`、`docs`）
- 提及可能受影响的下游包（从 workspace 依赖推断）
- 报告末尾如未提交变更，提醒是否需要提交

## 注意事项

- 只读操作，不修改任何文件或执行 git commit/push
- 保持简洁，不展开代码细节，只给文件级摘要
- 中英混合的项目，输出用中文
