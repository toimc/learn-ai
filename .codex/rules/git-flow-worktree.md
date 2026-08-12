# Git Flow + Worktree 工作流

本规则适用于所有代码、配置和文档改动，并覆盖 `CLAUDE.md` 中已经废弃的旧分支流程。

## 分支模型

| 角色 | 分支      | 用途                                                           |
| ---- | --------- | -------------------------------------------------------------- |
| 生产 | `master`  | 只接收合并与发版，不直接开发业务功能                           |
| 集成 | `dev`     | 所有 feature 的合并目标                                        |
| 功能 | `feat/*`  | 从 `dev` 创建，完成后合回 `dev`                                |
| 修复 | `fix/*`   | 生产紧急修复从 `master` 创建，完成后合回 `master` 并同步 `dev` |
| 维护 | `chore/*` | 通常从 `dev` 创建，完成后合回 `dev`                            |

## 强制规则

1. 开工前检查 `git status --short --branch`、当前分支和现有 worktree。
2. 若基线工作区存在未提交改动，先确认来源和范围；按用户要求提交，绝不覆盖或丢弃用户改动。
3. 所有改动都在独立 worktree 中完成，主工作区只做合并、发版和 worktree 管理。
4. worktree 路径使用 `.codex/worktrees/<分支名转短横线>/`。
5. feature/chore 基于 `dev`；生产 hotfix 基于 `master`。
6. 在 worktree 内完成实现、测试和提交。提交使用中文 Conventional Commits。
7. 不主动 push、创建或合并 PR、删除远端分支、发版或部署，除非用户明确要求。
8. 用户要求合并时，先确认目标分支无意外改动，再使用非快进合并保留任务边界。
9. 合并并确认无后续需要后，才移除对应 worktree；删除分支属于破坏性操作，必须在用户授权范围内执行。

## 创建 worktree

功能或维护任务示例：

```bash
git worktree add .codex/worktrees/feat-example -b feat/example dev
git worktree add .codex/worktrees/chore-example -b chore/example dev
```

紧急修复示例：

```bash
git worktree add .codex/worktrees/fix-example -b fix/example master
```

如果同名分支或目录已存在，先读取 `git worktree list --porcelain` 和分支状态，不要强行覆盖。

## 验证与提交

按改动风险选择验证范围：

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

提交格式：

```text
<type>(<scope>): <中文 subject>

<可选 body，解释为什么修改>
```

常用 type：`feat`、`fix`、`test`、`docs`、`refactor`、`chore`。scope 使用包或模块名，如 `core`、`vue`、`markdown`、`docs`、`deps`。

## 合并与清理

仅在用户要求合并时执行：

```bash
git checkout dev
git merge --no-ff <feature-or-chore-branch>
```

hotfix 合入 `master` 后必须再同步回 `dev`。清理前再次确认提交已可从目标分支访问，并确认 worktree 没有未提交改动。

## 发布与部署

- 项目当前未配置 Changesets，不要照搬旧文档直接运行 `pnpm changeset`。
- 发布策略、版本号、registry、tag 和部署命令必须由用户明确指定。
- 生产部署使用 `.codex/run/deploy.lock` 互斥。锁存在时检查记录的进程和时间，不覆盖活跃锁；清理残留锁前必须获得用户确认。
