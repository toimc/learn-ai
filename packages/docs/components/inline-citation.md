# InlineCitation 行内引用角标

正文中的上标引用角标：hover / focus 弹出悬浮卡展示来源详情（标题、引用片段、外链），多来源时卡片内 prev/next 轮播。适用于 RAG / 搜索引用场景，把回答正文里的 `[1]` 标记替换为本组件即可。

与 [Sources](./sources.md) 共用 `MessageSource` 协议（`@toimc/core` 导出）：

```typescript
interface MessageSource {
  id: string
  type: 'url' | 'document'
  title?: string
  url?: string        // type==='url' 时渲染外链（渲染前校验 http(s) 白名单）
  snippet?: string    // 引用片段，纯文本渲染（textContent，无 v-html 面）
  metadata?: Record<string, unknown>
}
```

## 基础用法

```vue
<script setup lang="ts">
import type { MessageSource } from '@toimc/core'
import { InlineCitation } from '@toimc/vue'

const sources: MessageSource[] = [
  {
    id: 'src_1',
    type: 'url',
    title: 'Vue 3 指南',
    url: 'https://vuejs.org/guide/introduction.html',
    snippet: 'Vue 是一款用于构建用户界面的 JavaScript 框架。',
  },
]
</script>

<template>
  <p>
    Vue 的响应式系统基于 Proxy 实现<InlineCitation :index="1" :sources="sources" />，
    组合式 API 是其核心心智模型。
  </p>
</template>
```

## 多来源轮播

一个角标关联多个来源时，悬浮卡头部出现 prev/next 按钮与 `当前/总数` 计数，循环切换：

```vue
<InlineCitation :index="1" :sources="sources" :card-width="320" />
```

## 安全与可达性

- snippet / 标题一律纯文本插值渲染，禁止 `v-html`
- `url` 渲染外链前经 `isSafeHttpUrl`（`@toimc/vue` 导出）校验 http(s) 白名单，`javascript:` 等协议自动降级为非链接按钮
- 键盘可达：focus-visible 描边、`Esc` 关闭、焦点移出组件才收起（角标 → 卡片内按钮的转移不误关）；鼠标离开但焦点仍在组件内时不会关闭
- 悬浮卡层叠等级走 `--ai-chat-z-popup` 令牌

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| index | `number` | — | 显示编号，从 1 起（必填） |
| sources | `MessageSource[]` | — | 该角标关联的来源（必填）；多来源时卡片内轮播 |
| cardWidth | `number` | `300` | 悬浮卡宽度（px） |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| select | `(source: MessageSource)` | 点击卡片内来源标题时触发（url 型同时打开外链） |

### Slots

无。自定义来源卡形态请使用 [Sources](./sources.md) 的 `source` 作用域插槽。
