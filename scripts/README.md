# 发布脚本目录

本目录包含 AI Chat UI 组件库的发布相关脚本。

## 📦 发布的包与顺序

需要发布到 npm 的 3 个包（脚本已按依赖顺序发布，无需手动调整）：

1. **`@toimc/core`** — 核心库（无依赖）
2. **`@toimc/vue`** — Vue 组件库（依赖 core）
3. **`@toimc/markdown`** — Markdown 渲染库（依赖 core + vue）

## 📁 脚本文件

### `publish.sh`
主发布脚本，支持两种发布模式：

**Changeset 模式（推荐）**：
```bash
pnpm changeset
NPM_TOKEN=your_token ./scripts/publish.sh --changeset
```

**手动版本模式**：
```bash
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0
```

**参数说明**：
- `-m, --manual VERSION` - 手动指定版本号
- `-c, --changeset` - 使用 changeset 模式
- `-t, --tag TAG` - 添加 git tag
- `-d, --dry-run` - 模拟运行
- `-h, --help` - 显示帮助

### `publish-test.sh`
发布前检查脚本，验证发布环境是否就绪：

```bash
./scripts/publish-test.sh
```

检查项：
- ✓ 环境依赖（jq, pnpm）
- ✓ 包配置文件
- ✓ 构建状态
- ✓ Git 工作区状态
- ✓ 版本管理

## 🚀 快速开始

### 1. 准备工作

```bash
# 确保工作区干净
git status

# 拉取最新代码
git pull origin master

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

**获取 npm Token**：登录 [npmjs.com](https://www.npmjs.com/) → Access Tokens 页面 → 创建 **Automation Token** → 复制保存，不要泄露。

### 2. 选择发布模式

**推荐：使用 Changeset**
```bash
# 创建 changeset
pnpm changeset

# 更新版本
pnpm changeset version

# 发布
NPM_TOKEN=your_token ./scripts/publish.sh --changeset
```

**手动指定版本**
```bash
# 直接发布指定版本
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0
```

### 3. 发布后操作

```bash
# 推送到 GitHub
git push origin master --tags

# 在 GitHub 上创建 Release
# 访问：https://github.com/your-org/ai-chat-ui/releases/new
```

## 🧪 测试发布

```bash
# 模拟发布流程（不实际发布）
NPM_TOKEN=your_token ./scripts/publish.sh --manual 1.0.0 --dry-run

# 或运行环境检查
./scripts/publish-test.sh
```

## 🔧 常见问题

### Q: jq 命令未找到？
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq
```

### Q: changeset 命令未找到？
```bash
pnpm add -D -w @changesets/cli
```

### Q: 如何回滚发布？
```bash
# 从 npm 撤销包
npm unpublish @toimc/core@version --force

# 恢复 git 状态
git reset --hard HEAD~1
```

## 📋 发布检查清单

发布前：
- [ ] Git 工作区干净
- [ ] 所有测试通过
- [ ] 类型检查通过（`pnpm type-check`）
- [ ] 构建成功
- [ ] 版本号正确，CHANGELOG 已更新（changeset 模式）
- [ ] npm token 有效

发布后：
- [ ] 包在 npm 上可见
- [ ] git tag 已推送
- [ ] GitHub Release 已创建
- [ ] 文档已更新

## 🔄 版本升级类型（SemVer）

- **patch** (0.0.x)：Bug 修复，向后兼容
- **minor** (0.x.0)：新功能，向后兼容
- **major** (x.0.0)：破坏性变更，不向后兼容

## 🔄 CI/CD 集成

项目包含 GitHub Actions workflow，支持：

1. **自动发布**：推送 tag 时自动发布
2. **手动发布**：在 GitHub Actions 页面手动触发
3. **变更验证**：自动运行测试和类型检查

配置文件：`.github/workflows/publish.yml`

## 📚 相关文档

- [Changeset 文档](https://github.com/changesets/changesets)
- [npm 发布文档](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [SemVer 规范](https://semver.org/lang/zh-CN/)