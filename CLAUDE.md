# ai-chat-ui 项目规范

## 项目概览

AI 聊天界面组件库 Monorepo，基于 Vue 3.5+ / TypeScript 5.x / Vite 6.x / pnpm workspace。

## 架构

Provider 抽象层模式：组件与 AI 后端完全解耦，通过 `ChatAdapter` 接口适配任何后端。

```
用户代码 → @ai-chat/vue (UI) → @ai-chat/core (composables) → ChatAdapter 接口 → 用户实现
```

## 包依赖关系

- `core` — 无外部依赖，纯 TypeScript，定义所有核心类型和 composables
- `vue` — 依赖 `core`，peer 依赖 `vue ^3.5.0`
- `markdown` — 依赖 `vue`，使用 Shiki + KaTeX
- `docs` — Vite 开发服务器 playground，依赖上述三个包

## 常用命令

```bash
pnpm dev          # 启动 docs playground
pnpm build        # 构建所有包
pnpm test         # 运行全部测试
pnpm test:watch   # 监听模式
pnpm lint         # ESLint 检查
pnpm type-check   # vue-tsc 类型检查
pnpm clean        # 清理所有 dist
```

## 核心类型（@ai-chat/core）

- `Message`：消息模型（id/role/content/attachments/metadata/createdAt）
- `StreamChunk`：流式块（type: text/tool_call/thinking/error/done）
- `ChatAdapter`：后端适配接口（sendMessage 返回 AsyncGenerator）
- `SendMessageOptions`：发送参数（messages/model/temperature/maxTokens/signal）
- `ChatOptions` / `ChatState`：useChat 的配置和返回值

## 编码规范

- 组件使用 `<script setup>` + TypeScript
- 状态管理用 `provide/inject`，不用 Pinia
- 样式用 CSS Variables（`--ai-chat-*`），不用 Tailwind
- 导出三格式：ESM (.mjs) + CJS (.cjs) + 类型声明 (.d.ts)
- 包之间用 `workspace:*` 引用

## 目录约定

```
packages/<pkg>/src/     ← 源码
packages/<pkg>/dist/    ← 构建产物（不提交）
packages/<pkg>/vite.config.ts
packages/<pkg>/tsconfig.json
packages/<pkg>/package.json
```

## 测试

- 单元测试用 Vitest，放在对应模块的 `.test.ts` 文件旁
- 组件测试用 `@vue/test-utils`
- `pnpm test` 从根目录跑所有包的测试
