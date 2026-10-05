# Sources 引用来源列表

AI 回答末尾的引用来源分组列表：默认折叠（点击标题展开），或 `inline` 横排徽标模式（超出 `maxInline` 折叠进 Popover）。由宿主挂在 `MessageContent` 下方组装，消费 `Message.sources`。

与 [InlineCitation](./inline-citation.md) 共用 `MessageSource` 协议（`@toimc/core` 导出）：

```typescript
interface MessageSource {
  id: string
  type: 'url' | 'document'
  title?: string
  url?: string        // type==='url' 时渲染外链（渲染前校验 http(s) 白名单）
  snippet?: string    // 引用片段，纯文本渲染
  metadata?: Record<string, unknown>
}
```

- `type === 'url'` 且通过 http(s) 白名单校验：渲染 `<a>` 外链（`target="_blank"` + `rel="noopener noreferrer"`）
- `type === 'document'`（或 url 校验不通过）：渲染非链接卡（标题 + snippet）

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import type { MessageSource } from '@toimc/core'
import { Sources } from '@toimc/vue'

const ragSources: MessageSource[] = [
  {
    id: 'r1',
    type: 'url',
    title: 'Mastra RAG 文档',
    url: 'https://mastra.ai/docs',
    snippet: '检索增强生成五环节：切块、嵌入、检索、重排、评估。',
  },
  {
    id: 'r2',
    type: 'url',
    title: 'LibSQL Vector 文档',
    url: 'https://docs.turso.tech/features/vector-search',
    snippet: 'F32_BLOB 存储，vector_top_k 查询上限 65536 维。',
  },
  {
    id: 'r3',
    type: 'document',
    title: '课程笔记《17-04 RAG 与语义检索》',
    snippet: '混合检索 = BM25 关键词 + 向量语义双路召回，2025-2026 事实标配。',
  },
  {
    id: 'r4',
    type: 'document',
    title: '内部评审记录',
    snippet: '47 篇文档约 200KB，切块后数百向量，嵌入式库性价比最高。',
  },
]

const lastSelected = ref('（尚未选择）')

function onSelect(source: MessageSource) {
  lastSelected.value = source.title ?? source.id
}
</script>

上：折叠列表模式（点击头部开合，来源卡片可自定义插槽）；下：inline 徽标模式，超出 `maxInline` 的来源折叠进 Popover：

<DemoContainer>
  <Sources :sources="ragSources" @select="onSelect" />
  <div
    style="height: 1px; margin: 16px 0; background: var(--vp-c-divider)"
  />
  <Sources :sources="ragSources" inline :max-inline="3" @select="onSelect" />
  <p
    style="
      margin: 12px 0 0;
      font-size: 12px;
      color: var(--ai-chat-color-text-muted);
    "
  >
    最近选中：{{ lastSelected }}
  </p>
</DemoContainer>

## 基础用法（折叠列表）

```vue
<script setup lang="ts">
import { Sources } from '@toimc/vue'

const sources = [
  {
    id: 'src_1',
    type: 'url',
    title: 'Vue 3 指南',
    url: 'https://vuejs.org/guide/introduction.html',
  },
  {
    id: 'src_2',
    type: 'document',
    title: '内部知识库：响应式原理',
    snippet: 'reactive 基于 Proxy 拦截读写…',
  },
]
</script>

<template>
  <Message>
    <MessageContent :content="answer" />
    <template #extra>
      <Sources :sources="sources" @select="onSelectSource" />
    </template>
  </Message>
</template>
```

默认标题为 i18n 计数文案（中文「来源 2 条」），可用 `title` 覆盖；`defaultOpen` 控制初始展开。

## inline 徽标模式

横排序号徽标，超过 `maxInline`（默认 3）折叠为 `+N` 按钮，点击展开 Popover 显示剩余来源：

```vue
<Sources :sources="sources" inline :max-inline="3" title="引用" />
```

## 自定义来源卡

`source` 作用域插槽交出渲染权，宿主可自定义卡片（自定义外链渲染时请复用 `isSafeHttpUrl` 校验）：

```vue
<Sources :sources="sources" default-open>
  <template #source="{ source, index }">
    <span class="my-source">{{ index + 1 }}. {{ source.title }}</span>
  </template>
</Sources>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| sources | `MessageSource[]` | — | 来源列表（必填） |
| title | `string` | i18n `citation.sources` | 分组标题（含计数）；inline 模式下仅显式传入时渲染 |
| inline | `boolean` | `false` | 横排徽标模式（Popover 展示详情）；默认折叠列表 |
| maxInline | `number` | `3` | inline 模式最多直接显示数，超出折叠进 Popover |
| defaultOpen | `boolean` | `false` | 初始展开态（非 inline 模式） |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| select | `(source: MessageSource, index: number)` | 点击任一来源（链接 / 非链接卡 / 徽标 / Popover 项）时触发，`index` 为在 `sources` 数组中的原始下标 |

### Slots

| 插槽名 | 作用域 | 说明 |
|--------|--------|------|
| source | `{ source: MessageSource, index: number }` | 自定义来源卡（仅折叠列表模式） |
