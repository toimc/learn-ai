# 安装

## 包概览

| 包名 | 必须 | 说明 |
|------|------|------|
| `@ai-chat/core` | 是 | 核心类型定义和 composables |
| `@ai-chat/vue` | 是 | Vue 3 UI 组件 |
| `@ai-chat/markdown` | 否 | Markdown / 代码 / LaTeX 渲染 |

## 包管理器

::: code-group

```bash [pnpm]
pnpm add @ai-chat/core @ai-chat/vue @ai-chat/markdown
```

```bash [npm]
npm install @ai-chat/core @ai-chat/vue @ai-chat/markdown
```

```bash [yarn]
yarn add @ai-chat/core @ai-chat/vue @ai-chat/markdown
```

:::

## peerDependencies

`@ai-chat/vue` 需要 Vue 3.5+ 作为 peer dependency，请确保项目中已安装：

```bash
pnpm add vue@^3.5.0
```

## 版本兼容

| ai-chat-ui | Vue | TypeScript |
|------------|-----|------------|
| 0.x        | 3.5+ | 5.x       |
