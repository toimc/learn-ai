# E2E 测试指南

本篇介绍 ai-chat-ui 的端到端（E2E）测试体系：如何使用 Playwright 进行浏览器自动化测试，覆盖完整的用户交互流程。承接 [测试指南](/guide/testing)，面向需要验证完整用户旅程的开发者。

## E2E 测试概述

E2E 测试通过真实的浏览器环境，验证从用户操作到界面反馈的完整链路。与单元测试和组件测试不同，E2E 测试：

- **真实浏览器环境**：使用 Chromium、Firefox、WebKit 等真实浏览器
- **完整用户流程**：模拟真实用户操作，验证端到端的功能
- **多浏览器支持**：确保跨浏览器兼容性
- **视觉回归检测**：自动截图，发现 UI 意外变化

## 前置要求

- Node.js ^22.18.0 || >=24.12.0
- pnpm >=10.0.0
- 端口 5173 未被占用

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 安装 Playwright 浏览器

```bash
# 安装所有浏览器
pnpm exec playwright install --with-deps

# 或只安装 Chromium（快速开始）
pnpm exec playwright install chromium
```

### 3. 运行测试

```bash
# 基础运行（后台模式）
pnpm test:e2e

# 有界面运行（推荐新手）
pnpm test:e2e:ui

# 调试模式
pnpm test:e2e:debug
```

## 测试命令说明

| 命令 | 说明 | 用途 |
|------|------|------|
| `pnpm test:e2e` | 后台运行所有测试 | CI/CD、批量测试 |
| `pnpm test:e2e:ui` | 有界面模式 | 开发调试、可视化执行 |
| `pnpm test:e2e:debug` | 调试模式 | 逐步调试、断点调试 |
| `pnpm test:e2e:headed` | 有头模式 | 看到浏览器执行过程 |
| `pnpm test:e2e:report` | 查看 HTML 报告 | 分析测试结果 |

## 测试文件说明

- **`playground-core.spec.ts`**: 核心用户流程（8 个用例：发送消息、会话列表切换、创建新对话、流式消息交互、基本 UI 交互、页面性能、移动端 / 桌面端视图）
- **`playground-simple.spec.ts`**: 页面结构与冒烟验证（14 个用例：应用加载、会话列表与切换、创建新会话、输入框与发送、主题与语言切换、响应式布局、快捷键、页面加载时间、控制台无错误、可访问性与键盘导航）
- **`global-setup.ts` / `global-teardown.ts`**: 全局装配与清理
- **`helpers/test-helpers.ts`**: 测试辅助函数（见下文）

## 常用场景

### 只运行某个测试文件

```bash
pnpm test:e2e playground-core.spec.ts
pnpm test:e2e playground-simple.spec.ts
```

### 只运行匹配的测试

```bash
# 只运行消息相关测试
pnpm test:e2e --grep "消息"

# 只运行会话相关测试
pnpm test:e2e --grep "会话"
```

### 调试特定测试

```bash
# UI 模式下选择特定测试
pnpm test:e2e:ui

# 调试模式运行特定文件
pnpm test:e2e:debug playground-core.spec.ts
```

## 测试覆盖范围

两个 spec 共 22 个用例，按用户旅程分组：

### 核心用户流程（playground-core，8 个用例）

- 发送消息并收到回复
- 会话列表切换与创建新对话
- 流式消息交互
- 基本 UI 交互功能
- 页面性能在可接受范围
- 移动端 / 桌面端视图适配

### 页面结构与冒烟（playground-simple，14 个用例）

- 应用正确加载（容器 / 侧边栏 / 主区域）
- 会话列表、切换、创建
- 输入框、发送功能与文本输入
- 主题切换按钮与语言切换功能
- 响应式布局与快捷键
- 页面加载时间合理、控制台无错误
- 基本可访问性支持与键盘导航

## 测试辅助函数

项目提供了 `e2e/helpers/test-helpers.ts`，包含 20 个测试辅助函数：

- 页面加载等待
- 消息发送和验证
- 会话切换管理
- 流式消息监控
- UI 交互操作
- 主题和侧边栏控制
- 调试辅助功能

## 配置特点

### 多环境支持

- **桌面浏览器**: Chromium、Firefox、WebKit
- **移动浏览器**: Mobile Chrome、Mobile Safari
- **并行策略**: CI 环境 1 个 worker 串行，本地按 CPU 核数默认并行

### 智能配置

- **自动重试**: CI 环境下 2 次重试
- **超时管理**: 30 秒测试超时，5 秒期望超时
- **失败记录**: 自动截图、录屏、追踪

### 开发友好

- **热重载**: 复用现有开发服务器
- **详细报告**: HTML、JSON、列表多种格式
- **调试支持**: UI 模式、断点、headless/headed 切换

## 故障排除

### 端口被占用

```bash
# 检查端口占用
lsof -i :5173

# 停止占用进程或修改 playwright.config.ts 中的端口
```

### 浏览器启动失败

```bash
# 重新安装浏览器
pnpm exec playwright install --force --with-deps
```

### 测试超时

```bash
# 增加超时时间（在 playwright.config.ts 中）
timeout: 60 * 1000  # 改为 60 秒
```

## 测试最佳实践

本项目 E2E 测试遵循以下最佳实践：

1. **清晰的测试描述**: 使用 `应该...` 格式描述测试目的
2. **独立的测试用例**: 每个测试可独立运行，无依赖关系
3. **适当的等待策略**: 使用显式等待而非固定时间
4. **语义化选择器**: 优先使用 data 属性和语义化 class
5. **复用辅助函数**: 避免重复代码，提高可维护性
6. **全面的错误处理**: 验证边界情况和错误处理

## CI/CD 集成

测试配置已包含 GitHub Actions 工作流（`.github/workflows/e2e-tests.yml`），支持：

- 按浏览器项目矩阵并行测试
- 移动端测试支持
- 测试结果与 HTML 报告自动归档为 artifact

## 延伸阅读

- [测试指南](/guide/testing) — 单元测试、组件测试与集成测试
- [单元测试实战](/guide/unit-testing) — 三场景用例设计技巧
- [开发指南](/guide/development) — 项目结构与编码规范
- [Playwright 官方文档](https://playwright.dev) — 完整参考手册

## 需要帮助？

- 查看 [Playwright 官方文档](https://playwright.dev)
- 查看项目文档和示例
- 提交 Issue 获取支持
