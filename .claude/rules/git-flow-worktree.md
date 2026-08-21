# Git Flow + Worktree 工作流规则

> 每个开发新功能的会话，**开工前必读本规则并严格遵守**。
> 本规则覆盖 `CLAUDE.md` 中旧的「单分支直接开发」描述。

## 分支模型

本项目采用标准 Git Flow。分支角色与实际分支名映射：

| Git Flow 角色 | 本项目分支 | 职责 |
|---|---|---|
| `main`（生产） | `master` | 生产分支，只接收合并与发版，**不写业务代码** |
| `dev`（集成） | `dev` | 集成分支，所有 feature 的合并目标 |
| `feature/*` | `feat/*` | 新功能，**从 `dev` 开** |
| `hotfix/*` | `fix/*` | 生产紧急修复，**从 `master` 开** |

## 五条铁律

1. **所有任务一律开 worktree 隔离** —— 不在主目录工作区写业务代码
2. **主目录只做合并 / 发版** —— 切到主目录仅为 `git merge`、`changeset version/publish`、打 tag
3. **feature 从 `dev` 开、做完合 `dev`**
4. **`dev` 领先 `master` 就合 `master` + 单一 bump 发版**（在 `master` 上做一次集中发版）
5. **hotfix 从 `master` 开、直合 `master` + bump 后反向同步回 `dev`**
6. **feature / hotfix 合并后立即删除该分支** —— 本地 `git branch -D` + 远端 `git push origin --delete`，合并即清理，不保留已合并分支（用 `-D` 而非 `-d`：分支合并进 dev/master 后其远端跟踪多为旧指针，`-d` 会误报「未完全合并」）

## Worktree 隔离

- 新功能开工：在 worktree 内建 feature 分支，所有代码改动与提交都在 worktree 内进行
- worktree 目录约定：`.claude/worktrees/<分支名>/`（已加入 `.gitignore`）
- 优先用 `EnterWorktree` 工具（自动管理目录与清理）；无该工具时手动：
  ```bash
  git worktree add .claude/worktrees/<分支名> -b <分支名> dev
  ```
- **完成并验证（测试通过）后**删除 worktree：
  ```bash
  git worktree remove .claude/worktrees/<分支名>
  ```

## 标准流程

### A. 新功能（feature：dev → dev）

```text
1. 主目录：git checkout dev && git pull
2. 开 worktree + feature 分支（基于 dev）
3. 在 worktree 内开发 → 提交（中文 Conventional Commits）
4. worktree 内跑通：pnpm test / pnpm type-check / pnpm lint
5. 合并回 dev（PR 或直接 merge）→ 删除 worktree → 删除 feature 分支（本地 `git branch -D` + 远端 `git push origin --delete`）
```

### B. 发版（dev → master，单一 bump）

```text
1. git checkout master && git pull
2. git merge dev                 # dev 领先 master 时
3. pnpm changeset version        # 集中 bump + CHANGELOG（首次需 pnpm changeset init）
4. pnpm changeset publish        # 按依赖顺序发布
5. git tag v<version> && git push --tags
6. git checkout dev && git merge master   # 保持 dev 同步
```

### C. 紧急修复（hotfix：master → master → 回流 dev）

```text
1. git checkout master && git pull
2. 开 worktree + hotfix 分支（基于 master）
3. 修复 → 提交 → 测试
4. 合并回 master → bump → 发布（同 B 的 3-5）
5. 反向同步：git checkout dev && git merge master
6. 删除 worktree → 删除 hotfix 分支（本地 `git branch -D` + 远端 `git push origin --delete`）
```

## 部署临界区（文件锁互斥）

生产部署是临界区，必须抢锁，**抢不到就排队等待**。用最简单的 `.lock` 文件实现。

锁文件：`.claude/run/deploy.lock`（已加入 `.gitignore`）

```bash
mkdir -p .claude/run
LOCK=".claude/run/deploy.lock"

# 抢锁：文件存在就排队等待
while [ -f "$LOCK" ]; do
  echo "⏳ 部署锁被占用：$(cat "$LOCK" 2>/dev/null)，10s 后重试" >&2
  sleep 10
done

# 写锁（记录谁在部署）
echo "{\"pid\":$$,\"by\":\"$USER\",\"started\":\"$(date +%FT%T)\"}" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT INT TERM   # 任何退出都释放锁

# ===== 部署逻辑 =====
# pnpm build && <你的部署命令>
```

- 抢到锁才部署，部署完（成功 / 失败）自动删锁
- 进程崩溃留下残留锁：检查锁内 PID 是否存活，确认无活跃部署后手动 `rm .claude/run/deploy.lock`
- 多人 / 多 CI 同时部署时，后者自动排队，绝不并发

## 每次开工自检

- [ ] 当前在 worktree 内？（不在则先建）
- [ ] 基于 `dev`（feature）或 `master`（hotfix）开分支？
- [ ] 主目录只用来合并 / 发版？
- [ ] 部署前抢 `.claude/run/deploy.lock`？
- [ ] 测试通过后再删 worktree？
