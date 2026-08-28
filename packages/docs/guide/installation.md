# 安装

## 包概览

| 包名 | 必须 | 说明 |
|------|------|------|
| `@toimc/core` | 是 | 核心类型定义和 composables |
| `@toimc/vue` | 是 | Vue 3 UI 组件 |
| `@toimc/markdown` | 否 | Markdown / 代码 / LaTeX 渲染 |
| `@toimc/agents` | 否 | 服务端模型适配层（多模型协议适配 + 可选 mastra 子路径，主入口零外部依赖，可脱离网关单独使用） |
| `@toimc/server` | 否 | Hono 聊天网关（接收与转发 + 可选 `/mastra` 子路径做 agent 集成，配套 [服务端网关](/guide/server) 指南） |

## 包管理器

::: code-group

```bash [pnpm]
pnpm add @toimc/core @toimc/vue @toimc/markdown
```

```bash [npm]
npm install @toimc/core @toimc/vue @toimc/markdown
```

```bash [yarn]
yarn add @toimc/core @toimc/vue @toimc/markdown
```

:::

## peerDependencies

`@toimc/vue` 需要 Vue 3.5+ 作为 peer dependency，请确保项目中已安装：

```bash
pnpm add vue@^3.5.0
```

`@toimc/agents` 与 `@toimc/server` 的 `/mastra` 子路径另有可选 peer 依赖 `@mastra/core`（配套 `@mastra/memory` / `@mastra/libsql` / `zod` 做会话记忆与工具 schema），仅在使用[智能体接入](/guide/mastra)时安装，不影响两个包的主入口：

```bash
pnpm add @mastra/core @mastra/memory @mastra/libsql zod
```

## 可选样式：KaTeX 公式

`@toimc/markdown` 不再自动注入 KaTeX 样式。需要渲染 LaTeX 公式时，手动引入子路径样式（约 25KB CSS + 数学字体，不用公式的项目可省去）：

```ts
import '@toimc/markdown/katex.css'
```

不引入该 CSS 时，代码高亮、Mermaid 图表等功能不受影响，仅公式无 KaTeX 排版样式。

## 版本兼容

| ai-chat-ui | Vue | TypeScript |
|------------|-----|------------|
| 0.x        | 3.5+ | 5.x       |
