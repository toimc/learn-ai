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

## 引入组件样式

`@toimc/vue` 的组件样式需要手动引入（JS 产物不自动注入 CSS，便于宿主控制加载时机与按需覆盖）：

```ts
import '@toimc/vue/style.css'
```

不引入该 CSS 时组件仍可工作但无视觉样式（布局/主题令牌/暗色模式均在此文件中）。主题定制方式见[主题系统](/guide/theming)。

## peerDependencies

`@toimc/vue` 与 `@toimc/core` 需要 Vue 3.5+ 作为 peer dependency（core 的 reactive 状态与宿主共享同一 Vue 实例），请确保项目中已安装：

```bash
pnpm add vue@^3.5.0
```

`@toimc/agents` 与 `@toimc/server` 的 `/mastra` 子路径另有可选 peer 依赖 `@mastra/core`（配套 `@mastra/memory` / `@mastra/libsql` / `zod` 做会话记忆与工具 schema），仅在使用[智能体接入](/guide/mastra)时安装，不影响两个包的主入口：

```bash
pnpm add @mastra/core @mastra/memory @mastra/libsql zod
```

自建网关若还要做文档语义检索（RAG），加装 `@mastra/rag`（`MDocument` 切块）配合 `@mastra/libsql` 同包的 `LibSQLVector` 向量库即可，详见[智能体接入的语义检索一节](/guide/mastra#语义检索-libsqlvector-本地-ollama-rag)：

```bash
pnpm add @mastra/rag
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
