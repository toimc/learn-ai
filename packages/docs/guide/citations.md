---
title: 引用与来源
---

# 引用与来源

RAG / 搜索类回答的引用展示由两件组件承担，共用一套 `MessageSource` 协议：

- [`InlineCitation`](/components/inline-citation) — 正文里的 `[1]` 上标角标，hover / focus 弹出悬浮卡预览来源
- [`Sources`](/components/sources) — 回答末尾的来源列表（折叠列表 / inline 徽标两种模式）

本页讲清协议本身、两件组件怎么组合，以及 RAG 场景下从 `tool_result` 提取 sources 的宿主侧配方。在线演示见 [RAG 引用演示](/citation-demo)。

## MessageSource 协议

`@toimc/core` 导出，挂在 [`Message.sources`](/components/message) 上随消息流转：

```typescript
import type { MessageSource } from '@toimc/core'

interface MessageSource {
  id: string                    // 稳定唯一标识（v-for key、去重）
  type: 'url' | 'document'      // url 渲染外链；document 渲染非链接卡
  title?: string                // 来源标题
  url?: string                  // type==='url' 时的外链；渲染前经 http(s) 白名单校验
  snippet?: string              // 引用片段，纯文本渲染（无 v-html 面）
  metadata?: Record<string, unknown>  // 评分、页码等宿主扩展位
}
```

设计约束：

- **id 必填且稳定**——同一来源在一次回答的角标与列表里复用同一 id，宿主可用它做去重与跳转对齐。
- **snippet / title 一律纯文本插值**，不进 HTML 管道；`url` 渲染外链前经 `isSafeHttpUrl`（`@toimc/vue` 导出）校验，`javascript:` 等协议自动降级为非链接。
- `metadata` 是弱约定扩展位：检索评分、文档页码、高亮区间都放这里，组件不消费。

## 组合用法

标准形态是「正文角标 + 末尾列表」：结论句后放 `InlineCitation`，`Message` 尾部挂 `Sources`，两者引用同一份 `sources` 数组。

```vue
<script setup lang="ts">
import type { MessageSource } from '@toimc/core'
import { Message, MessageContent, InlineCitation, Sources } from '@toimc/vue'

const sources: MessageSource[] = [
  {
    id: 's1',
    type: 'document',
    title: '内部知识库 · 响应式原理',
    snippet: 'reactive 基于 Proxy 拦截读写…',
    metadata: { score: 0.87 },
  },
  {
    id: 's2',
    type: 'url',
    title: 'Vue 3 指南',
    url: 'https://vuejs.org/guide/introduction.html',
  },
]
</script>

<template>
  <Message from="assistant">
    <!-- content prop 走 markdown 渲染时无法内嵌组件：带角标的正文用默认插槽拼装 -->
    <MessageContent>
      <p>
        Vue 的响应式系统基于 Proxy 实现<InlineCitation :index="1" :sources="[sources[0]]" />，
        组合式 API 是其核心心智模型<InlineCitation
          :index="2"
          :sources="[sources[0], sources[1]]"
        />。
      </p>
    </MessageContent>
    <Sources :sources="sources" @select="(s) => trackSourceOpen(s.id)" />
  </Message>
</template>
```

要点：

- **角标编号由宿主分配**：`index` 从 1 起，通常等于来源在数组中的序号 + 1；多来源共用一个角标时悬浮卡内出现 prev / next 轮播。
- **`MessageContent` 的 `content` prop 走 markdown 渲染管道，无法内嵌 Vue 组件**——带角标的正文用默认插槽以模板拼装（上文写法）；纯 markdown 正文则不放行内角标，只挂末尾 `Sources`。
- `Sources` 默认折叠列表（i18n 计数标题），`inline` 切换横排徽标模式；`source` 作用域插槽可完全自定义来源卡。

## RAG 场景配方：从 tool_result 提取 sources

检索类工具的返回值是 sources 的天然产地。推荐把「提取」放在宿主的流式消费层（`useChat` 的 chunk 处理或 adapter 内），而不是塞进组件：

```typescript
// adapter 侧：消费检索工具的 tool_result chunk，提取来源挂到 assistant 消息
import type { Message, MessageSource, StreamChunk } from '@toimc/core'

interface SearchDocHit {
  title: string
  source?: string // 原文路径或 URL
  snippet: string
  score?: number
}

function extractSources(result: { hits?: SearchDocHit[] }): MessageSource[] {
  return (result.hits ?? []).map((hit, i) => {
    const isUrl = /^https?:\/\//.test(hit.source ?? '')
    return {
      id: `hit_${i}`, // 工具结果内下标即可稳定；跨工具合并时加工具名前缀
      type: isUrl ? 'url' : 'document',
      title: hit.title,
      url: isUrl ? hit.source : undefined,
      snippet: hit.snippet.slice(0, 200),
      metadata: hit.score != null ? { score: hit.score } : undefined,
    }
  })
}

// 流式消费（示意）：tool_result 到达时累积 sources，done 时落到消息上
function attachSources(chunk: StreamChunk, draft: Partial<Message>) {
  if (
    chunk.type === 'tool_result' &&
    chunk.metadata?.toolName === 'search_docs'
  ) {
    const result = (chunk.metadata.toolResult ?? {}) as { hits?: SearchDocHit[] }
    const prev = draft.sources ?? []
    draft.sources = [...prev, ...extractSources(result)]
  }
}
```

流水线全景：

```text
search_docs tool_result
  → extractSources() 归一为 MessageSource[]（宿主层）
  → message.sources 累积（多轮检索合并、按 id 去重）
  → 正文生成时模型输出 [1][2] 标记
  → 渲染层把标记位替换为 <InlineCitation>（或让模型直接留编号、正文走插槽拼装）
  → 消息尾部挂 <Sources :sources="message.sources" />
```

工程建议：

- **去重合并**：多轮检索 / 多工具各回一批命中时，按 `url` 或 `title + snippet 前缀` 归并，`id` 保持首次分配值，角标编号才不跳变。
- **snippet 截断**：悬浮卡不做行数裁剪逻辑，过长的片段宿主侧先截（如 200 字符）。
- **评分放 metadata 不进 title**：展示层想渲染「相关度 87%」时从 `source.metadata.score` 取，协议本体保持干净。
- **select 事件只做埋点跳转**：点击来源的打开行为组件已处理（url 型开新标签），宿主在 `select` 里做埋点与二级面板即可。
