# JsonDiffView

JSON 差异视图：VSCode 风格双列对比（左旧值右新值），嵌套对象按 `a.b.c` 路径展平对齐，删除行红、新增行绿、修改行左红右绿，修改行内再做字符级公共前后缀切分高亮。全程纯文本分段 `span` 渲染，**零 `v-html`**，无 XSS 面。适用于工具调用参数对比、配置变更回显、消息编辑前后对照。

## 基础用法

```vue
<script setup lang="ts">
import { JsonDiffView } from '@toimc/vue'

const oldValue = { model: 'gpt-4o', temperature: 0.7, stream: true }
const newValue = { model: 'gpt-4o-mini', temperature: 0.7, stream: false }
</script>

<template>
  <JsonDiffView :old-value="oldValue" :new-value="newValue" />
</template>
```

- 表头默认走 i18n（中文「修改前 / 修改后」），可用 `oldLabel` / `newLabel` 覆盖
- 非对象输入（string / number / null / undefined / 数组）按单值行处理，数组整体序列化不逐项展开

## 仅显示差异

`onlyChanged` 过滤掉相同路径，全同时显示空态文案（i18n `jsonDiff.identical`，中文「内容相同」）：

```vue
<JsonDiffView :old-value="oldValue" :new-value="newValue" only-changed />
```

## 字符级高亮

修改行的字符串值按公共前后缀切分：不变部分正常渲染，中间变化片段以红（旧）/绿（新）底高亮。实现为纯分段 `span` 拼接，渲染前不产生任何 HTML 字符串。

## 边界行为

| 输入 | 行为 |
|------|------|
| 循环引用 | WeakSet 栈式守卫，该路径渲染 `[Circular]` 标记，不再递归；兄弟节点重复引用同一对象不误报 |
| 嵌套超过 32 层 | 该路径整行序列化（防极端深结构拖垮渲染） |
| BigInt 等无法 JSON 序列化值 | 降级 `String()` 表示 |
| `undefined` / `null` | 分别渲染 `undefined` / `null` |

## 主题定制

红绿衍生色默认由主题状态令牌 `color-mix` 派生，宿主可在任意祖先层级定义同名变量覆盖：

```css
:root {
  --ai-chat-jsondiff-del-bg: rgba(239, 68, 68, 0.12);
  --ai-chat-jsondiff-add-bg: rgba(16, 185, 129, 0.14);
  --ai-chat-jsondiff-char-del-bg: rgba(239, 68, 68, 0.45);
  --ai-chat-jsondiff-char-add-bg: rgba(16, 185, 129, 0.45);
}
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| oldValue | `unknown` | 必填 | 旧值 |
| newValue | `unknown` | 必填 | 新值 |
| oldLabel | `string` | i18n `jsonDiff.oldLabel` | 左列表头 |
| newLabel | `string` | i18n `jsonDiff.newLabel` | 右列表头 |
| onlyChanged | `boolean` | `false` | 只显示有差异的路径 |

### CSS 变量

| 变量名 | 默认值（派生自状态令牌） | 说明 |
|--------|--------------------------|------|
| --ai-chat-jsondiff-del-bg | `color-mix(status-error 12%)` | 删除/修改旧侧行背景 |
| --ai-chat-jsondiff-add-bg | `color-mix(status-success 14%)` | 新增/修改新侧行背景 |
| --ai-chat-jsondiff-char-del-bg | `color-mix(status-error 45%)` | 旧值字符级变化片段背景 |
| --ai-chat-jsondiff-char-add-bg | `color-mix(status-success 45%)` | 新值字符级变化片段背景 |
