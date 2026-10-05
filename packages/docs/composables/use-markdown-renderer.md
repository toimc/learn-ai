# useMarkdownRenderer

Markdown 渲染组件的 provide / inject 注入通道：宿主在应用入口注入一次 `MarkdownRenderer`（来自 `@toimc/markdown`），`MessageContent` 即自动把 `content` 渲染为 Markdown——不必逐处传组件 Props。

## 适用场景

| 场景 | 说明 |
|------|------|
| 应用入口统一装配 | 宿主（或 VitePress `enhanceApp`）`app.provide(markdownRendererKey, MarkdownRenderer)` 一次，全树消息自动启用 Markdown 渲染 |
| 未注入时优雅降级 | inject 缺省返回 `null`，`MessageContent` 回退纯文本渲染，不报错 |
| 按需替换渲染实现 | 注入的是「组件」本身——宿主可换用自己的 Markdown 渲染组件，消息组件零改动 |
| 避免 Markdown 包强耦合 | 不注入时 `@toimc/vue` 不依赖 `@toimc/markdown`，两包可独立引入 |

**典型消费组件**：[MessageContent](/components/message)（`content` prop 经本通道取渲染器：有则 Markdown、无则纯文本）。注入方参考：本文档站 `.vitepress/theme/index.ts` 的 `app.provide(markdownRendererKey, MarkdownRenderer)`。

## 代码演示

<script setup lang="ts">
import { Message, MessageContent } from '@toimc/vue'

const demoMd = [
  '**流式 Markdown 渲染**：支持 `行内代码`、列表与代码块。',
  '',
  '- 列表项一',
  '- 列表项二',
  '',
  '```ts',
  'const renderer = useMarkdownRenderer()',
  '```',
].join('\n')
</script>

本站已在主题入口注入渲染器，下面的 `MessageContent` 直接渲染 Markdown（**加粗**、`行内代码`、列表、代码块随内容生效）：

<DemoContainer>
  <Message from="assistant">
    <MessageContent :content="demoMd" />
  </Message>
</DemoContainer>

## 函数签名

```typescript
/** 注入键（Symbol），类型安全 InjectionKey<Component> */
export const markdownRendererKey: InjectionKey<Component>

/** 提供方：在组件树上层调用 */
function provideMarkdownRenderer(renderer: Component): void

/** 消费方：取注入的渲染组件，未注入返回 null */
function useMarkdownRenderer(): Component | null
```

## 行为

- `provide` / `inject` 的一对薄封装，核心价值是导出类型安全的 `InjectionKey`，避免宿主手写字符串键。
- 一个应用只应注入一次；重复注入时子树取最近一层 provider。

## 相关

- [MessageContent](/components/message)（消费方）
- [MarkdownRenderer](/components/markdown-renderer)（`@toimc/markdown` 的渲染组件）
