# Welcome 欢迎页

富欢迎页组件，用于对话开始前的首屏引导：头部图标 + 标题 + 描述 + 内容区（通常放 [`Prompts`](./prompts.md) 建议词）+ 底部附加信息。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import { Prompts, Welcome } from '@toimc/vue'
import type { PromptItem } from '@toimc/vue'

const promptItems: PromptItem[] = [
  { key: 'weekly', label: '写一份周报', description: '把本周工作整理成结构化周报', icon: '📝' },
  { key: 'explain', label: '解释这段代码', description: '逐行说明作用与设计意图', icon: '💡' },
  { key: 'review', label: '审查组件 Props', description: '对照业界组件库检查 API 设计', icon: '🔍' },
]

const lastPrompt = ref('（尚未选择）')
</script>

### 默认图标 + 建议词

不传 `icon` 插槽时渲染默认星形徽标，默认插槽放 [Prompts](./prompts.md) 建议词——产品化首屏引导的最常见组合：

<DemoContainer>
  <Welcome
    title="AI 组件库助手"
    description="问我任何关于组件用法、Props 或最佳实践的问题"
  >
    <Prompts :items="promptItems" @select="(item) => (lastPrompt = item.label)" />
    <p
      style="
        margin: 12px 0 0;
        font-size: 12px;
        color: var(--ai-chat-color-text-muted);
      "
    >
      最近选择：{{ lastPrompt }}
    </p>
  </Welcome>
</DemoContainer>

### 自定义图标 + 附加信息

`icon` 插槽放产品 logo，`extra` 插槽放版本号、声明等附加内容——适合品牌化的开场页：

<DemoContainer>
  <Welcome description="选择一个话题开始，或直接输入你的问题">
    <template #icon>🤖</template>
    <p
      style="
        margin: 0;
        font-size: 13px;
        color: var(--ai-chat-color-text-muted);
      "
    >
      默认插槽：放置搜索框、Prompts 等引导内容
    </p>
    <template #extra>
      <span style="font-size: 12px">extra 插槽：版本号 / 免责声明</span>
    </template>
  </Welcome>
</DemoContainer>

## 与 ConversationEmpty 的分工

两者都可用在"还没有消息"的场景，定位不同：

- **ConversationEmpty** — 列表空态**轻提示**：默认图标 + 标题/描述 + suggestions 插槽，占位即可、开箱即用
- **Welcome** — **富欢迎页**：三插槽布局（icon / default / extra），default 区放建议词入口（`Prompts`），extra 区放声明、入口链接等附加内容，适合产品化的首屏引导

简单空态用 `ConversationEmpty`；需要"图标 + 标题 + 描述 + 建议词 + 附加信息"完整结构时用 `Welcome`。

## 基础用法

`title` / `description` 缺省走 i18n 字典（`welcome.title` / `welcome.description`），传 props 则优先；内容区放 `Prompts`：

```vue
<script setup lang="ts">
import { Welcome, Prompts } from '@toimc/vue'
import type { PromptItem } from '@toimc/vue'

const items: PromptItem[] = [
  { key: 'weekly', label: '写一份周报', description: '把本周工作整理成结构化周报', icon: '📝' },
  { key: 'explain', label: '解释这段代码', description: '逐行说明作用与设计意图', icon: '💡' },
]
</script>

<template>
  <Welcome description="选择一个话题开始，或直接输入你的问题">
    <Prompts :items="items" @select="(item) => console.log(item)" />
  </Welcome>
</template>
```

## 自定义图标

`icon` 插槽替换头部图标区（默认渲染一个星形 svg 徽标），常放产品 logo：

```vue
<Welcome>
  <template #icon>
    <img src="/logo.svg" alt="logo" style="width: 52px; height: 52px; border-radius: 16px;">
  </template>
  <Prompts :items="items" />
</Welcome>
```

## 底部附加信息

`extra` 插槽渲染在内容区下方，适合放服务条款、备案号、快捷入口等；未传则不渲染该区域：

```vue
<Welcome>
  <Prompts :items="items" />
  <template #extra>
    <a href="/terms">服务条款</a> · <a href="/privacy">隐私政策</a>
  </template>
</Welcome>
```

## API

### Welcome

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| title | `string` | i18n `welcome.title`（中有什么可以帮你的？/ 英 How can I help you?） | 欢迎页标题 |
| description | `string` | i18n `welcome.description` | 欢迎页描述；传空字符串可不渲染描述行 |

| 插槽名 | 说明 |
|--------|------|
| icon | 头部图标区，默认渲染星形 svg 徽标 |
| default | 内容区，通常放 `Prompts` 建议词卡片 |
| extra | 底部附加区（声明、链接等）；未传不渲染 |

组件根节点撑满父容器高度并垂直居中，常与 `ConversationContent` 配合：`messages.length === 0` 时渲染 `Welcome`，有消息后切换为消息列表。
