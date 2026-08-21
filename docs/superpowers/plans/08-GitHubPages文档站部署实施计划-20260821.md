# GitHub Pages 文档站部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** push 到 master 自动构建 VitePress 文档站并发布到 GitHub Pages（`https://toimc.github.io/learn-ai/`），发布版剔除依赖本地 mock-server 的两个页面。

**Architecture:** `DOCS_TARGET=pages` 环境变量作为构建期开关驱动 VitePress 条件构建（srcExclude + nav 过滤 + base + define 常量折叠）；部署走官方三件套 `configure-pages` → `upload-pages-artifact` → `deploy-pages`，仅用内置 GITHUB_TOKEN。

**Tech Stack:** VitePress 1.6.4 / GitHub Actions（Node 24 + pnpm 11.21.0）/ GitHub Pages

**工作目录：** 全程在 worktree `.claude/worktrees/chore-docs-github-pages/`（分支 `chore/docs-github-pages`，基于 `dev` d8b2858）内进行，下述相对路径均以 worktree 根为基准。Task 7-8 回主目录操作。

**Spec:** `docs/superpowers/spec/08-GitHubPages文档站部署-20260821.md`

**前置：** worktree 内先 `corepack pnpm install --frozen-lockfile` 装依赖（worktree 是独立目录，无 node_modules）。本项目 pnpm 由 corepack 托管，裸 `pnpm` 会被 asdf 拦截。

---

### Task 1: VitePress 构建开关（config.ts）

**Files:**
- Modify: `packages/docs/.vitepress/config.ts`

- [ ] **Step 1: 安装依赖**

```bash
cd .claude/worktrees/chore-docs-github-pages
corepack pnpm install --frozen-lockfile
```

预期：安装成功，lockfile 未变。

- [ ] **Step 2: 修改 config.ts**

文件头部（`const root = ...` 之后）加：

```ts
import type { DefaultTheme } from 'vitepress'

// GitHub Pages 发布构建开关：DOCS_TARGET=pages 时剔除依赖本地 mock-server 的页面（spec 08 FR-2）
const isPages = process.env.DOCS_TARGET === 'pages'

// 仅本地开发可用的导航项（依赖 pnpm dev 同时启动的 mock-server）
const mockOnlyNav: DefaultTheme.NavItem[] = [
  { text: 'Mock 演示', link: '/mock-server-demo' },
  { text: '接口文档', link: '/mock-api' },
]
```

（`import type { DefaultTheme }` 合并到顶部现有 import 区域；`resolve`/`defineConfig` import 保持不变。）

`defineConfig({` 内部加三个顶层字段（放在 `description` 之后）：

```ts
  base: process.env.BASE_PATH || '/',
  srcExclude: isPages ? ['mock-server-demo.md', 'mock-api.md'] : [],
```

`vite: {` 内加 `define`（与现有 `resolve` 平级）：

```ts
  vite: {
    define: {
      // 构建期注入字面量：客户端组件（MockOnly）与 theme 的条件分支据此做常量折叠
      'import.meta.env.DOCS_TARGET': JSON.stringify(process.env.DOCS_TARGET ?? ''),
    },
    resolve: { /* 现有 alias 不变 */ },
  },
```

`themeConfig.nav` 中删除「Mock 演示」「接口文档」两个原字面量项，改为：

```ts
    nav: [
      /* 指南/组件/Composables/Playground/主题配置器 各项保持原样 */
      ...(isPages ? [] : mockOnlyNav),
    ],
```

- [ ] **Step 3: 双模式构建验证（红灯）**

```bash
DOCS_TARGET=pages BASE_PATH=/learn-ai/ corepack pnpm -C packages/docs build
ls packages/docs/.vitepress/dist/mock-server-demo.html packages/docs/.vitepress/dist/mock-api.html 2>&1
grep -c "mock-server-demo\|mock-api" packages/docs/.vitepress/dist/index.html || echo "index 无 mock 链接"
grep -o "/learn-ai/assets/[^"]*\.js" packages/docs/.vitepress/dist/index.html | head -1
```

预期：`ls` 报 No such file（两页面被剔除）；grep 计数为 0（导航无 mock 项）；最后一行输出 `/learn-ai/...` 前缀（base 生效）。

- [ ] **Step 4: 默认构建验证（不回归）**

```bash
corepack pnpm -C packages/docs build
ls packages/docs/.vitepress/dist/mock-server-demo.html packages/docs/.vitepress/dist/mock-api.html
```

预期：两个 html 都存在；构建无死链报错（证明 srcExclude 只在 pages 模式生效）。

- [ ] **Step 5: Commit**

```bash
git add packages/docs/.vitepress/config.ts
git commit -m "feat(docs): VitePress增加DOCS_TARGET构建开关

为什么：GitHub Pages 发布版必须剔除依赖本地 mock-server 的页面，
本地开发零变化；srcExclude+导航过滤+base+define 四处由同一开关驱动"
```

---

### Task 2: MockOnly 组件与 playground.md 包裹

**Files:**
- Create: `packages/docs/.vitepress/components/MockOnly.vue`
- Modify: `packages/docs/.vitepress/theme/index.ts`（注册组件，与 Task 3 同文件不同步骤）
- Modify: `packages/docs/playground.md:10`

- [ ] **Step 1: 创建 MockOnly.vue**

```vue
<script setup lang="ts">
// 仅本地开发渲染：Pages 构建（DOCS_TARGET=pages）剔除依赖本地 mock-server 的内容
// 值由 config.ts 的 vite.define 构建期替换为字面量，非运行时变量
const isPagesBuild = import.meta.env.DOCS_TARGET === 'pages'
</script>

<template>
  <div v-if="!isPagesBuild"><slot /></div>
</template>
```

- [ ] **Step 2: theme/index.ts 注册**

import 区（`DemoContainer` import 旁）加：

```ts
import MockOnly from '../components/MockOnly.vue'
```

`enhanceApp` 注册区（`app.component('DemoContainer', DemoContainer)` 之后）加：

```ts
    app.component('MockOnly', MockOnly)
```

- [ ] **Step 3: playground.md 包裹提示块**

第 10 行的 blockquote 用组件包裹（组件标签与内容之间必须空行，markdown 才会编译）：

```md
<MockOnly>

> 💡 想体验**真实 HTTP + SSE 流式**（会话数据来自本地 mock 服务端，token 粒度逐字输出）？前往 [Mock 服务端演示](/mock-server-demo)（聊天区自适应占满视口剩余高度，场景触发词已做成输入区快捷 chip 按钮，发送按钮流式中自动切换为停止）；接口清单与在线执行见 [接口文档](/mock-api)。

</MockOnly>
```

（blockquote 原文不动，只加首尾标签与空行。）

- [ ] **Step 4: 双模式构建验证**

```bash
DOCS_TARGET=pages BASE_PATH=/learn-ai/ corepack pnpm -C packages/docs build
grep -c "Mock 服务端演示" packages/docs/.vitepress/dist/playground.html || echo "pages 版无 mock 提示"
corepack pnpm -C packages/docs build
grep -c "Mock 服务端演示" packages/docs/.vitepress/dist/playground.html
```

预期：第一组 grep 为 0（提示块被剔除）；第二组 grep ≥ 1（本地版保留）。

- [ ] **Step 5: Commit**

```bash
git add packages/docs/.vitepress/components/MockOnly.vue packages/docs/.vitepress/theme/index.ts packages/docs/playground.md
git commit -m "feat(docs): 新增MockOnly组件包裹playground的mock提示块

为什么：提示块链接的两个页面在 Pages 版被剔除，链接会死；
构建期条件渲染让本地提示保留、发布版干净"
```

---

### Task 3: theme 条件动态 import（Scalar 不进 Pages 产物）

**Files:**
- Modify: `packages/docs/.vitepress/theme/index.ts:59-71`（`@toimc/playground` import）、`:77`（enhanceApp）、`:143-144`（注册）

- [ ] **Step 1: 改 import 与注册**

`@toimc/playground` 静态 import 列表中**删除** `MockServerDemoPage,` 和 `MockApiPage,` 两行（其余不动）。

`enhanceApp({ app }) {` 保持同步签名，在文件顶部（`import './style.css'` 之后）加：

```ts
// Pages 构建剔除 mock 页面组件：define 注入的字面量使分支被常量折叠，
// 动态 import 不进产物，Scalar standalone（~1MB+）不进 Pages bundle
const isPagesBuild = import.meta.env.DOCS_TARGET === 'pages'
```

原 143-144 行的注册替换为（放在 `enhangeApp` 内、其他注册之后）：

```ts
    if (!isPagesBuild) {
      const { MockServerDemoPage, MockApiPage } = await import('@toimc/playground')
      app.component('MockServerDemoPage', MockServerDemoPage)
      app.component('MockApiPage', MockApiPage)
    }
```

同时 `enhanceApp({ app }) {` 改为 `async enhanceApp({ app }) {`。

- [ ] **Step 2: 双模式构建验证**

```bash
DOCS_TARGET=pages BASE_PATH=/learn-ai/ corepack pnpm -C packages/docs build
grep -rl "scalar" packages/docs/.vitepress/dist/assets/ | head -3 || echo "pages 版无 Scalar chunk"
corepack pnpm -C packages/docs build
grep -rl "scalar" packages/docs/.vitepress/dist/assets/ | head -3
```

预期：pages 版输出「无 Scalar chunk」；本地版能找到 Scalar 相关 chunk（含 standalone 模块）。

- [ ] **Step 3: Commit**

```bash
git add packages/docs/.vitepress/theme/index.ts
git commit -m "perf(docs): mock页面组件改条件动态import

为什么：MockApiPage 内嵌 Scalar standalone 约 1MB，静态注册会全量
进入 Pages 产物；define 常量折叠让发布版完全不含该依赖"
```

---

### Task 4: docs-deploy workflow

**Files:**
- Create: `.github/workflows/docs-deploy.yml`

- [ ] **Step 1: 写 workflow 文件**

```yaml
name: Deploy Docs

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.21.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: corepack pnpm install --frozen-lockfile

      - name: Build docs
        run: corepack pnpm -C packages/docs build
        env:
          DOCS_TARGET: pages
          BASE_PATH: /learn-ai/

      - name: Setup Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: packages/docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

（注意：CI 的 ubuntu-latest 无 asdf 拦截，但统一用 `corepack pnpm` 与本地习惯一致；`enablement: true` 兜底自动开启 Pages。）

- [ ] **Step 2: YAML 语法验证**

```bash
npx --yes yaml-lint .github/workflows/docs-deploy.yml
```

预期：输出 `✓` 或无错误退出。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docs-deploy.yml
git commit -m "ci(docs): 添加GitHub Pages文档站部署workflow

为什么：文档站需公开访问；官方deploy-pages三件套仅用内置
GITHUB_TOKEN，master 推送即原子部署，可回滚"
```

---

### Task 5: development.md 补部署说明

**Files:**
- Modify: `packages/docs/guide/development.md`（「样式隔离」小节之后、「Git 分支模型」之前插入）

- [ ] **Step 1: 插入小节**

```markdown
## 文档部署（GitHub Pages）

文档站随 `master` 分支自动部署：<https://toimc.github.io/learn-ai/>（GitHub Actions `Deploy Docs` workflow，官方 `deploy-pages` 三件套，仅用内置 `GITHUB_TOKEN`）。

**mock 页面开关**：`/mock-server-demo` 与 `/mock-api` 依赖本地 mock-server（`pnpm dev` 同时启动，端口 8787），静态站点不可用。发布构建通过 `DOCS_TARGET=pages` 环境变量在构建期剔除这两个页面（`srcExclude` + 导航过滤 + `MockOnly` 组件 + theme 条件注册），并设置 `BASE_PATH=/learn-ai/` 资源前缀。

本地开发不受影响：`pnpm dev` 与普通 `pnpm -C packages/docs build` 不设这两个变量，mock 页面照常可用。需要本地预览发布版效果时：

```bash
DOCS_TARGET=pages BASE_PATH=/learn-ai/ corepack pnpm -C packages/docs build
corepack pnpm -C packages/docs preview
```
```

- [ ] **Step 2: 验证 markdown 不破坏 VitePress 构建**

```bash
corepack pnpm -C packages/docs build
```

预期：构建成功（guide/development 被重新渲染）。

- [ ] **Step 3: Commit**

```bash
git add packages/docs/guide/development.md
git commit -m "docs(guide): 开发指南补充文档部署与mock页面开关说明

为什么：Pages 版 mock 页面消失需要文档解释，满足代码-文档
同步门禁；后续开发者需知道如何本地预览发布版"
```

---

### Task 6: 全量验证（worktree 内）

- [ ] **Step 1: 构建 core 出 dist（type-check 前置，worktree 已知坑）**

```bash
corepack pnpm -C packages/core build
```

- [ ] **Step 2: 三绿**

```bash
corepack pnpm test
corepack pnpm type-check
corepack pnpm lint
```

预期：测试全过、类型零错误、lint 零错误。若 lint 报 theme/config 的风格问题就地修复后重跑。

- [ ] **Step 3: 复跑两种 docs 构建确认最终状态**

重复 Task 1 Step 3/4 的验证命令，预期一致。

---

### Task 7: 合并回 dev 并清理（主目录）

- [ ] **Step 1: 主目录合并**

```bash
cd /Users/toimc/Downloads/2025vite+vue3课程/notes/09/resources/ai-chat-ui
git merge chore/docs-github-pages
```

预期：fast-forward 或干净合并（dev d8b2858 是分支直接祖先）。

- [ ] **Step 2: 推送 dev**

```bash
git push origin dev
```

- [ ] **Step 3: 删 worktree 与分支**

```bash
git worktree remove .claude/worktrees/chore-docs-github-pages
git branch -D chore/docs-github-pages
```

---

### Task 8: 开启 Pages + 合并 master + Actions 实测

**⚠️ PAT 仅通过环境变量内存传递，不写入任何文件。**

- [ ] **Step 1: API 开启 Pages（build_type=workflow）**

```bash
GH_TOKEN=<用户提供的PAT> gh api repos/toimc/learn-ai/pages -X POST -f build_type=workflow
```

预期：201（已存在则 409，改用 `-X PATCH -f build_type=workflow`；403 权限不足则依赖 workflow 的 `enablement: true` 兜底）。

- [ ] **Step 2: 抢部署锁并合并 master**

```bash
mkdir -p .claude/run
echo '{"by":"claude","task":"docs-pages-deploy"}' > .claude/run/deploy.lock
git checkout master && git merge dev && git push origin master
```

预期：master 合并干净并推送成功，远端触发 `Deploy Docs` workflow。

- [ ] **Step 3: 盯 Actions 运行**

```bash
gh run list --workflow=deploy-docs --limit 1
gh run watch <run-id> --exit-status
```

预期：build + deploy 两 job 全绿。

- [ ] **Step 4: 线上验收（spec 验收标准 2/3）**

```bash
curl -sI https://toimc.github.io/learn-ai/ | head -1
curl -sI https://toimc.github.io/learn-ai/mock-server-demo | head -1
curl -sI https://toimc.github.io/learn-ai/mock-api | head -1
curl -s https://toimc.github.io/learn-ai/ | grep -o "Mock 演示\|接口文档" | head -2 || echo "导航干净"
```

预期：依次 200 / 404 / 404 / 「导航干净」。

- [ ] **Step 5: 释放锁、回 dev**

```bash
rm .claude/run/deploy.lock
git checkout dev
```

- [ ] **Step 6: 提醒用户轮换对话中暴露的 PAT**

---

## Self-Review 记录

- **Spec 覆盖**：FR-1→Task 4、FR-2→Task 1/3、FR-3→Task 2、FR-4→Task 1 Step 3 死链验证（VitePress 默认死链失败）、FR-5→Task 5、NFR→Task 8（无 secret、可回滚）、验收标准→Task 1/2/3 Step 双模式验证 + Task 6 + Task 8 Step 4
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码
- **类型一致性**：`import.meta.env.DOCS_TARGET` 在 MockOnly.vue 与 theme/index.ts 一致；`DOCS_TARGET`/`BASE_PATH` 环境变量名全程一致；分支/workflow 名一致
