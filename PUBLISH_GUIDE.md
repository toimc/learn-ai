# AI Chat UI 组件库发包指南

## 📦 需要发布的包

本项目共有 **3个包** 需要发布到 npm：

1. **`@toimc/core`** - 核心库（无依赖）
2. **`@toimc/vue`** - Vue 组件库（依赖 core）
3. **`@toimc/markdown`** - Markdown 渲染库（依赖 core + vue）

**发布顺序**：core → vue → markdown（按依赖关系）

## 🚀 发布方式

### 方式一：使用 Changeset 自动管理版本（推荐）

```bash
# 1. 创建 changeset（会询问你改了什么，以及版本升级类型）
pnpm changeset

# 2. 更新版本号并生成 CHANGELOG
pnpm changeset version

# 3. 构建并发布
NPM_TOKEN=your_token ./scripts/publish.sh --changeset
```

### 方式二：手动指定版本

```bash
# 直接发布指定版本
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0
```

## 🔑 获取 npm Token

1. 登录 [npmjs.com](https://www.npmjs.com/)
2. 进入 **Access Tokens** 页面
3. 创建新的 **Automation Token**（7天有效期）
4. 复制 token，不要泄露！

## 📝 发布流程详解

### 使用 Changeset 模式（推荐）

```bash
# 1. 确保工作区干净
git status

# 2. 拉取最新代码
git pull origin master

# 3. 创建 changeset
pnpm changeset
# 会询问：
# - 哪些包需要更新？（选择相应的包）
# - 变更类型是什么？（patch/minor/major）
# - 变更摘要是什么？（简短描述）

# 4. 提交 changeset 文件
git add .changeset/*.md
git commit -m "chore: add changeset for version bump"

# 5. 更新版本
pnpm changeset version
# 这会：
# - 更新所有 package.json 的 version 字段
# - 生成 CHANGELOG.md
# - 删除已消费的 changeset 文件

# 6. 提交版本更新
git add .
git commit -m "chore: version bump"

# 7. 发布到 npm
NPM_TOKEN=your_token ./scripts/publish.sh --changeset --tag v1.0.0

# 8. 推送到 GitHub
git push origin master --tags
```

### 手动版本模式

```bash
# 1. 确保工作区干净
git status

# 2. 拉取最新代码
git pull origin master

# 3. 直接发布（自动更新版本号）
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0 --tag v1.0.0

# 4. 推送到 GitHub
git push origin master --tags
```

## 🧪 测试发布（Dry Run）

```bash
# 模拟发布流程，不实际发布
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0 --dry-run
```

## 🔧 脚本参数说明

```bash
./scripts/publish.sh [选项]

选项：
  -m, --manual VERSION      手动指定版本号 (如: 1.0.0)
  -c, --changeset          使用 changeset 模式（自动生成 CHANGELOG）
  -t, --tag TAG            添加 git tag (如: v1.0.0)
  -d, --dry-run            模拟运行，不实际发布
  -h, --help               显示帮助信息

环境变量：
  NPM_TOKEN                npm 认证 token (必需)
  NPM_REGISTRY            npm registry 地址 (默认: https://registry.npmjs.org)
```

## 📋 发布检查清单

发布前确认：

- [ ] Git 工作区干净（无未提交的更改）
- [ ] 所有测试通过（`pnpm test`）
- [ ] 类型检查通过（`pnpm type-check`）
- [ ] 构建成功（`pnpm build`）
- [ ] 版本号正确
- [ ] CHANGELOG 已更新（changeset 模式）
- [ ] npm token 有效且未过期

发布后确认：

- [ ] 所有包已在 npm 上可见
- [ ] git tag 已推送到 GitHub
- [ ] 在 GitHub 上创建 Release 页面
- [ ] 更新项目文档（如有必要）

## 🎯 发布最佳实践

1. **使用 Changeset**：推荐使用 changeset 模式，自动管理版本和 CHANGELOG
2. **语义化版本**：遵循 SemVer 规范（major.minor.patch）
3. **测试先行**：发布前确保所有测试通过
4. **工作区干净**：不要在未提交代码的情况下发布
5. **Git Tag**：每次发布都打 tag，便于回溯
6. **Release Notes**：在 GitHub 上创建 Release，包含变更说明

## 🔄 版本升级类型

- **patch** (0.0.x)：Bug 修复，向后兼容
- **minor** (0.x.0)：新功能，向后兼容
- **major** (x.0.0)：破坏性变更，不向后兼容

## ⚠️ 常见问题

### Q: 发布失败怎么办？
A: 检查：
1. npm token 是否有效
2. 网络连接是否正常
3. 包名是否冲突
4. 工作区是否有未提交的更改

### Q: 如何回滚发布？
A: 
1. 立即从 npm 撤销包：`npm unpublish @toimc/core@version --force`
2. 修复问题
3. 重新发布新版本

### Q: 多包发布顺序问题？
A: 脚本已按依赖顺序发布：core → vue → markdown，无需手动调整

## 📞 支持

如有问题，请联系项目维护者或查阅：
- [npm 发布文档](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [Changeset 文档](https://github.com/changesets/changesets)
- [SemVer 规范](https://semver.org/lang/zh-CN/)