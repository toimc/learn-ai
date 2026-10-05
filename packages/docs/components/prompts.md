# Prompts 提示词面板

建议词卡片列表，通常放在 [`Welcome`](./welcome.md) 内容区作为对话入口。每张卡片展示 label + description + icon，点击后组件把整条 `PromptItem` 通过 `select` 事件上抛，由宿主决定发送还是进入二级。

## 基础用法

`title` 缺省走 i18n 字典（`prompts.title`，中文「试试这样问」/ 英文「Try asking」），传 props 优先：

```vue
<script setup lang="ts">
import { Prompts } from '@toimc/vue'
import type { PromptItem } from '@toimc/vue'

const items: PromptItem[] = [
  { key: 'weekly', label: '写一份周报', description: '把本周工作整理成结构化周报', icon: '📝' },
  { key: 'code', label: '解释这段代码', description: '逐行说明作用与设计意图', icon: '💡' },
  { key: 'idea', label: '头脑风暴', description: '围绕一个主题展开多个方向', icon: '🚀' },
]

function handleSelect(item: PromptItem) {
  // 宿主拿到 item 后自行处理：发送消息、进入二级等
}
</script>

<template>
  <Prompts :items="items" @select="handleSelect" />
</template>
```

## 布局：vertical / wrap

默认横向单行排列（超出横向滚动）；`vertical` 纵向列表，`wrap` 横向换行：

```vue
<Prompts :items="items" vertical />
<Prompts :items="items" wrap />
```

## 二级提示（children 数据透传）

`PromptItem.children` 携带二级提示数据，但组件**不渲染二级内容**——一级点击时 `select` 事件把含 `children` 的完整 item 原样透传，展示形态由宿主决定（换一组 items 重新渲染、弹出面板、跳转均可）：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Prompts } from '@toimc/vue'
import type { PromptItem } from '@toimc/vue'

const topics: PromptItem[] = [
  {
    key: 'writing',
    label: '写作助手',
    description: '周报、文案、润色',
    children: [
      { key: 'weekly', label: '帮我写周报' },
      { key: 'polish', label: '润色一段文案' },
    ],
  },
  { key: 'chat', label: '随便聊聊' },
]

const current = ref<PromptItem[]>(topics)

function handleSelect(item: PromptItem) {
  if (item.children?.length) current.value = item.children
  else sendMessage(item.label)
}
</script>

<template>
  <Prompts :items="current" vertical @select="handleSelect" />
</template>
```

## 自定义卡片

`item` 作用域插槽拿到 `{ item }` 自定义卡片内容；交互（点击、键盘）仍由组件处理，`select` 照常上抛：

```vue
<Prompts :items="items">
  <template #item="{ item }">
    <span class="my-card">
      <strong>{{ item.label }}</strong>
      <em>{{ item.description }}</em>
    </span>
  </template>
</Prompts>
```

## 键盘可达

每张卡片渲染为原生 `<button type="button">`，Tab 聚焦、Enter / Space 触发点击均开箱可用；聚焦态通过 `focus-visible` 展示 `--ai-chat-control-ring` 焦点环。

## API

### Prompts

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| items | `PromptItem[]` | —（必填） | 提示项列表 |
| title | `string` | i18n `prompts.title` | 面板标题 |
| vertical | `boolean` | `false` | 纵向排列 |
| wrap | `boolean` | `false` | 横向换行（默认单行横向滚动） |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| select | `(item: PromptItem)` | 点击卡片时上抛完整 item；含 `children` 时原样透传 |

| 插槽名 | 作用域参数 | 说明 |
|--------|------------|------|
| item | `{ item: PromptItem }` | 自定义卡片内容；缺省渲染 icon + label + description |

### PromptItem

| 属性 | 类型 | 说明 |
|------|------|------|
| key | `string` | 唯一标识（v-for key） |
| label | `string` | 卡片主文案 |
| description | `string` | 卡片补充说明，可选 |
| icon | `string` | 图标透传（emoji / 字符），可选；复杂图标用 `item` 插槽渲染 |
| children | `PromptItem[]` | 二级提示数据，组件不渲染、`select` 原样透传由宿主决定展示形态 |
