# GitHub Pages 文档站部署需求

> 日期：2026-08-21 ｜ 状态：已批准（用户确认方案 A，mock 构建期剔除，仅 master 触发）

## 背景与目标

项目文档站（`packages/docs`，VitePress 1.6.4）目前只能本地 `pnpm dev` 访问。目标：push 到 `master` 时通过 GitHub Actions 自动构建并发布到 GitHub Pages（`https://toimc.github.io/learn-ai/`），提供公开可访问的文档站。

约束：文档站中 `/mock-server-demo` 与 `/mock-api` 两个页面硬编码连接本地 mock-server（`http://localhost:8787`，Hono + SSE），静态站点上必然不可用，**发布版必须构建期剔除**；本地开发体验保持零变化。

## 功能需求

### FR-1 部署 workflow

- 触发：push 到 `master` + `workflow_dispatch`（手动重部署）；不加 paths 过滤（文档内容经 alias 引用全部包源码，master 推送即版本合并）
- 机制：官方三件套 `actions/configure-pages@v5`（`enablement: true` 自动开启 Pages）→ `actions/upload-pages-artifact@v3`（path: `packages/docs/.vitepress/dist`）→ `actions/deploy-pages@v4`
- 权限：`contents: read`、`pages: write`、`id-token: write`；concurrency `github-pages` 组排队不取消
- 环境：Node 24 + pnpm 11.21.0（与 publish.yml 一致），`pnpm install --frozen-lockfile` 后直接 `pnpm -C packages/docs build`（docs 经 vite alias 直连各包源码，无需预构建子包）
- 认证：仅用内置 `GITHUB_TOKEN`，**不引入任何 PAT/secret**

### FR-2 构建开关（DOCS_TARGET）

`DOCS_TARGET=pages` 环境变量驱动 VitePress 条件构建，`isPages` 时：

1. `srcExclude: ['mock-server-demo.md', 'mock-api.md']`（相对 srcDir 根）
2. `themeConfig.nav` 移除「Mock 演示」「接口文档」两个入口
3. `base` 取 `BASE_PATH` 环境变量（CI 传 `/learn-ai/`，默认 `/`）
4. `vite.define` 注入 `import.meta.env.DOCS_TARGET` 字面量供客户端判断
5. `theme/index.ts` 中 `MockServerDemoPage`/`MockApiPage` 改条件动态 import——define 常量折叠消除 pages 构建的 import 分支，**Scalar standalone（~1MB+）不进 Pages 产物**

默认（本地 dev/普通 build）行为完全不变：mock 页面、导航、Scalar 均保留。

### FR-3 MockOnly 组件【执行时取消】

原方案：新增 `MockOnly.vue` 组件包裹 `playground.md` 的 mock 提示块。**执行时发现该方案无必要**：`PlaygroundPage` 布局组件只渲染 `<PlaygroundDemo />`、无 `<Content />` 出口，`playground.md` 正文（含提示块）本就不会出现在页面上，无需运行时条件渲染。提示块内两个链接触发的死链检查是静态 AST 扫描，已由 FR-2 的 `ignoreDeadLinks`（仅 pages 模式精确放行 `/mock-server-demo`、`/mock-api`）解决。

### FR-4 死链安全网

VitePress 默认死链构建失败。站内引用 mock 两页面的仅 `playground.md`（FR-3 处理）与两页面自身（被剔除），构建即验证。若未来新增引用遗漏，CI 直接红灯而非上线坏链。

### FR-5 文档同步

`packages/docs/guide/development.md` 增补「文档部署与 mock 页面开关」小节：说明 `DOCS_TARGET`/`BASE_PATH` 用法、Pages URL、本地 dev 不受影响（满足代码-文档同步门禁）。

## 非功能需求

- **安全**：PAT 不落盘不进版本控制（仅一次性 API 调用走环境变量，用后建议用户轮换）；workflow 无自定义 secret
- **可回滚**：deploy-pages 支持在 Actions 页面一键回滚到历史部署
- **构建速度**：pnpm store 缓存；只构建 docs（不做全量 build/test——e2e-tests.yml 已在 dev 分支守质量门）

## 验收标准

1. push master 后 workflow 绿：build + deploy 两个 job 成功
2. `https://toimc.github.io/learn-ai/` 返回 200，站点资源（带 `/learn-ai/` base）加载正常
3. 线上站导航无「Mock 演示」「接口文档」；直访 `/learn-ai/mock-server-demo`、`/learn-ai/mock-api` 为 404
4. Pages 产物 `dist/` 无两 mock 页面 html、assets 无 Scalar chunk
5. 本地 `pnpm dev` 与普通 `pnpm -C packages/docs build`：mock 页面、导航、提示块、Scalar 全部保留，行为与改造前一致
6. `pnpm test`、`pnpm type-check` 全绿

## 实施注意

- dev 领先 master 245 提交，部署验证走「dev 完整合并 master」（用户已确认方案 a）；npm 发版为独立决策，不在本任务范围
- worktree 内 type-check 需先 build core 出 dist（项目已知坑）
- docs-sync 门禁：本任务改 `packages/docs` 即文档本身，另补 FR-5 满足

## 交付物

- `.github/workflows/docs-deploy.yml`（新增）
- `packages/docs/.vitepress/config.ts`（构建开关：srcExclude + nav 过滤 + base + define + ignoreDeadLinks）
- `packages/docs/.vitepress/theme/index.ts`（条件动态 import）
- ~~`packages/docs/.vitepress/components/MockOnly.vue`~~（FR-3 取消）
- ~~`packages/docs/playground.md`（提示块包裹）~~（FR-3 取消）
- `packages/docs/guide/development.md`（部署说明小节）
- 仓库 Pages 配置：来源 GitHub Actions（API 一次性配置）
