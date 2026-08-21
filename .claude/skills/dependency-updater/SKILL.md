---
name: dependency-updater
description: 通用依赖更新 Skill，自动检测项目语言和包管理器，安全更新依赖（自动应用 minor/patch，逐个确认 major），支持安全审计和依赖诊断
---

# Dependency Updater

智能依赖管理，支持任意语言，自动检测并安全更新。

---

## 触发条件

| 场景 | 触发示例 |
|------|---------|
| 更新依赖 | "update dependencies"、"更新依赖"、"update deps" |
| 检查过期包 | "check for outdated packages"、"检查依赖版本" |
| 修复依赖问题 | "fix my dependency problems"、"修复依赖冲突" |
| 安全审计 | "audit dependencies for vulnerabilities"、"检查安全漏洞" |
| 诊断依赖 | "diagnose dependency issues"、"诊断依赖问题" |

---

## 支持的语言

| 语言 | 包文件 | 更新工具 | 审计工具 |
|------|--------|---------|---------|
| **Node.js** | package.json | `taze` | `npm audit` |
| **Python** | requirements.txt, pyproject.toml | `pip-review` | `pip-audit` |
| **Go** | go.mod | `go get -u` | `govulncheck` |
| **Rust** | Cargo.toml | `cargo update` | `cargo audit` |
| **Ruby** | Gemfile | `bundle update` | `bundle audit` |
| **Java** | pom.xml, build.gradle | `mvn versions:*` | `mvn dependency:*` |
| **.NET** | *.csproj | `dotnet outdated` | `dotnet list package --vulnerable` |

---

## 更新策略

| 更新类型 | 版本变化 | 操作 |
|---------|---------|------|
| **固定版本** | 无 `^` 或 `~` 前缀 | 跳过（有意锁定） |
| **PATCH** | `x.y.z` → `x.y.Z` | 自动应用 |
| **MINOR** | `x.y.z` → `x.Y.0` | 自动应用 |
| **MAJOR** | `x.y.z` → `X.0.0` | 逐个询问用户 |

---

## 工作流程

```
用户请求
    │
    ▼
┌──────────────────────────────────────┐
│ Step 1: 检测项目类型                  │
│ • 扫描包文件 (package.json, go.mod…) │
│ • 识别包管理器                        │
├──────────────────────────────────────┤
│ Step 2: 检查前置工具                  │
│ • 确认所需工具已安装                   │
│ • 缺失时提示安装命令                   │
├──────────────────────────────────────┤
│ Step 3: 扫描更新                      │
│ • 运行对应语言的过期检查              │
│ • 分类：MAJOR / MINOR / PATCH / 固定  │
├──────────────────────────────────────┤
│ Step 4: 自动应用安全更新              │
│ • 自动应用 MINOR 和 PATCH             │
│ • 报告已更新的内容                    │
├──────────────────────────────────────┤
│ Step 5: 确认 MAJOR 更新              │
│ • 对每个 MAJOR 更新逐一询问用户       │
│ • 展示当前版本 → 新版本               │
├──────────────────────────────────────┤
│ Step 6: 应用已确认的 MAJOR 更新       │
│ • 仅更新用户批准的包                  │
├──────────────────────────────────────┤
│ Step 7: 收尾                         │
│ • 运行安装命令                        │
│ • 运行安全审计                        │
│ • 运行构建和测试验证                   │
└──────────────────────────────────────┘
```

---

## Step 1: 检测项目类型

扫描当前目录，识别项目语言和包管理器：

| 文件 | 语言 | 包管理器 |
|------|------|---------|
| `package.json` | Node.js | npm/yarn/pnpm/bun |
| `requirements.txt` | Python | pip |
| `pyproject.toml` | Python | pip/poetry |
| `Pipfile` | Python | pipenv |
| `go.mod` | Go | go modules |
| `Cargo.toml` | Rust | cargo |
| `Gemfile` | Ruby | bundler |
| `pom.xml` | Java | Maven |
| `build.gradle` | Java/Kotlin | Gradle |
| `*.csproj` | .NET | dotnet |

**Monorepo 检测**：检查 `package.json` 的 `workspaces` 字段，或 `pnpm-workspace.yaml` 文件。

---

## Step 2: 检查前置工具

```bash
# Node.js - 检查 taze
command -v taze || echo "请安装: npm install -g taze"

# Python - 检查 pip-audit
command -v pip-audit || echo "请安装: pip install pip-audit"

# Go - 检查 govulncheck
command -v govulncheck || echo "请安装: go install golang.org/x/vuln/cmd/govulncheck@latest"

# Rust - 检查 cargo-audit
command -v cargo-audit || echo "请安装: cargo install cargo-audit"
```

---

## Step 3-6: 各语言命令

### Node.js (npm/yarn/pnpm)

```bash
# 扫描所有更新
taze

# 自动应用 minor + patch
taze minor --write

# 对每个 MAJOR 更新，使用 AskUserQuestion 询问用户
# 确认后应用指定的 major 更新
taze major --write --include pkg1,pkg2

# Monorepo 支持
taze -r

# 安装
npm install    # 或 pnpm install / yarn
```

### Python

```bash
# 检查过期包
pip list --outdated

# 交互式更新
pip-review --interactive

# 更新指定包
pip install --upgrade <package>
```

### Go

```bash
# 检查过期
go list -m -u all

# 更新全部
go get -u ./...

# 整理
go mod tidy
```

### Rust

```bash
# 检查过期
cargo outdated

# 更新（semver 范围内）
cargo update
```

### Ruby

```bash
# 检查过期
bundle outdated

# 更新全部
bundle update

# 保守更新指定包
bundle update --conservative <gem-name>
```

### Java (Maven)

```bash
# 检查过期
mvn versions:display-dependency-updates

# 更新到最新
mvn versions:use-latest-releases
```

### .NET

```bash
# 检查过期
dotnet list package --outdated

# 更新指定包
dotnet add package <PackageName>
```

---

## Step 7: 收尾

### 安装依赖

```bash
# Node.js
npm install      # 或 pnpm install / yarn

# Python
pip install -r requirements.txt

# Go
go mod tidy

# Rust
cargo build

# Ruby
bundle install
```

### 安全审计

```bash
# Node.js
npm audit

# Python
pip-audit

# Go
govulncheck ./...

# Rust
cargo audit

# Ruby
bundle audit

# .NET
dotnet list package --vulnerable
```

**漏洞严重等级响应：**

| 严重等级 | 建议处理时间 |
|---------|------------|
| Critical | 立即修复 |
| High | 24 小时内 |
| Moderate | 一周内 |
| Low | 下次发布修复 |

### 构建和测试验证

按项目实际 scripts 验证：

```bash
<pm> run build
<pm> run test
<pm> run lint        # 如果有
<pm> run type-check  # 如果有
```

---

## 诊断模式

当依赖出问题时，运行诊断：

### 常见问题

| 问题 | 症状 | 修复 |
|------|------|------|
| 版本冲突 | "Cannot resolve dependency tree" | 清理重装，用 overrides/resolutions |
| Peer 依赖 | "Peer dependency not satisfied" | 安装所需 peer 版本 |
| 安全漏洞 | `npm audit` 报告问题 | `npm audit fix` 或手动更新 |
| 废弃依赖 | 包体积膨胀 | 运行 `depcheck`（Node）或等效工具 |
| 重复依赖 | 安装了多个版本 | 运行 `npm dedupe` 或等效工具 |

### 紧急修复

```bash
# Node.js - 彻底重置
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Python - 重建虚拟环境
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Go - 重置模块
rm go.sum
go mod tidy
```

---

## 输出格式

更新完成后输出汇总报告：

```
## 依赖更新报告

### 更新摘要
- patch 更新：X 个（自动应用）
- minor 更新：X 个（自动应用）
- major 更新：X 个（已确认 X 个，跳过 X 个）
- 固定版本：X 个（跳过）
- 已是最新：X 个

### 更新详情
| 包名 | 旧版本 | 新版本 | 类型 |
|------|--------|--------|------|
| ...  | ...    | ...    | ...  |

### 验证结果
- [x] install 通过
- [x] build 通过
- [x] test 通过
- [x] security audit 通过

### 待处理（如有）
- ...
```

---

## 反模式

| 避免 | 原因 | 正确做法 |
|------|------|---------|
| 更新固定版本 | 有意锁定 | 跳过 |
| 自动应用 MAJOR | 有 breaking changes | 询问用户 |
| 批量确认 MAJOR | 丢失上下文 | 逐个确认 |
| 忽略 lock 文件 | 不可复现构建 | 始终提交 lock 文件 |
| 忽略安全告警 | 可被利用 | 按严重等级处理 |

---

## 推荐工具安装

| 语言 | 工具 | 安装命令 |
|------|------|---------|
| Node.js | taze | `npm install -g taze` |
| Node.js | npm-check-updates | `npm install -g npm-check-updates` |
| Python | pip-review | `pip install pip-review` |
| Python | pip-audit | `pip install pip-audit` |
| Go | govulncheck | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| Rust | cargo-audit | `cargo install cargo-audit` |
| Ruby | bundler-audit | `gem install bundler-audit` |
