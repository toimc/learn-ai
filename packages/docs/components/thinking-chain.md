# ThinkingChain 多步骤思维链

结构化推理步骤的时间线展示组件。与 ThinkingBlock 的分工：

- **ThinkingBlock** — 单块思考文本（`thinking.content`），流式渲染
- **ThinkingChain** — 结构化多步骤（`thinking.steps`），适合 RAG 检索链路、Agent 任务拆解等服务端组装的推理过程

## 基础用法

```vue
<script setup lang="ts">
import { ThinkingChain } from '@toimc/vue'
import type { ThinkingStep } from '@toimc/core'

const steps: ThinkingStep[] = [
  { id: 's1', title: '解析意图', status: 'complete', duration: 800, content: '识别出用户在问天气' },
  { id: 's2', title: '检索文档', status: 'active' },
  { id: 's3', title: '生成回答', status: 'pending' },
]
</script>

<template>
  <ThinkingChain :steps="steps" />
</template>
```

`ThinkingStep` 类型（`@toimc/core` 导出）：

```typescript
interface ThinkingStep {
  id: string
  title: string
  status: 'pending' | 'active' | 'complete' | 'error'
  content?: string
  /** 单步耗时 ms */
  duration?: number
}
```

## 结构

两级折叠（照搬 ChatGPT 式思维链交互）：

- **外层总折叠**：头部 = 标题 + 总耗时 + 步骤数；点击展开步骤列表
- **步骤行**：状态图标 + title + 状态标签 + duration；有 content 的步骤可单独展开

步骤状态图标：

| status | 图标 | 说明 |
|--------|------|------|
| pending | ○ | 等待中（muted） |
| active | ● | 进行中（accent 色 + 呼吸动画） |
| complete | ✓ | 完成（success 色） |
| error | ✗ | 失败（error 色） |

呼吸动画在 `prefers-reduced-motion: reduce` 下自动关闭。

## 流式自动开合

`streaming` 复用 ThinkingBlock 的状态机语义：

- 流式开始（`streaming: true`）→ 自动展开实时展示步骤
- 流式结束（`streaming: false`）→ 自动折叠为头部摘要
- **用户接管**：任何一次手动点击后，开合状态完全归用户，流式起止不再干预

```vue
<ThinkingChain :steps="steps" :streaming="message.thinking?.active" />
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| steps | `ThinkingStep[]` | — | 步骤数组（必填；空数组不渲染） |
| title | `string` | i18n `thinking.title` | 头部标题 |
| totalDuration | `number` | 自动求和 | 总耗时 ms；缺省时取各步骤 duration 之和 |
| line | `'solid' \| 'dashed' \| 'none'` | `'solid'` | 步骤间连接线样式 |
| streaming | `boolean` | `false` | 流式标志（自动开合状态机） |
| defaultExpanded | `boolean` | `streaming` | 外层初始展开态 |

### 耗时格式化

复用 `formatDuration`（`<1000ms` 显示 `800ms`，`≥1000ms` 显示 `1.5s`）。
