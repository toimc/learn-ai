# BranchPicker 消息分支翻页

消息分支（版本）翻页组件：`‹ 版本 1/3 ›` 工具条 + 当前分支内容容器。适用于「重新生成产生多版本回复」「用户编辑产生多版本输入」等场景，在几个分支间来回切换查看。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import { BranchPicker } from '@toimc/vue'

const branches = [
  '分支 0：初版回答（简洁直答）',
  '分支 1：补充了示例（推荐 ★）',
  '分支 2：深度解析版（含原理推导）',
]

const active = ref(1)
</script>

点击左右箭头在分支间翻页，正文随 `change` 事件切换：

<DemoContainer>
  <p style="margin: 0 0 8px; min-height: 22px">{{ branches[active] }}</p>
  <BranchPicker
    :branch-count="branches.length"
    :active-branch="active"
    @change="(i: number) => (active = i)"
  />
</DemoContainer>

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { BranchPicker } from '@toimc/vue'

const branches = ['第一版回答', '重新生成后的回答', '再次生成的回答']
const active = ref(0)
</script>

<template>
  <BranchPicker
    :branch-count="branches.length"
    :active-branch="active"
    @change="(i) => (active = i)"
  >
    <MessageContent :content="branches[active]" />
  </BranchPicker>
</template>
```

- **`branchCount <= 1` 时组件整体不渲染**（`null`）——单分支无需翻页；宿主也可自行 `v-if` 控制。
- Prev/Next 在首/末分支禁用（`disabled` + 不 emit）；翻页不循环。
- `activeBranch` 为 0-based；越界值会被钳制到 `[0, branchCount-1]` 再计算标签与翻页目标，不会渲染出 `6/3` 之类的标签。
- default 插槽渲染当前分支内容；各分支怎么切换渲染（`v-if` / `v-show` / 数组取值）由宿主决定。

## 分支数据约定（Message.metadata.branches）

分支数据按社区常见形态走 `Message.metadata` 上的弱约定（core 类型不改，宿主自行声明）：

```ts
interface Message {
  // ...
  metadata?: {
    /** 各分支内容；branches[i] 对应第 i 个版本 */
    branches?: string[]
    /** 当前展示的分支（0-based），缺省视为 0 */
    activeBranch?: number
  }
}
```

配合示例：

```vue
<template>
  <BranchPicker
    v-if="msg.metadata?.branches"
    :branch-count="msg.metadata.branches.length"
    :active-branch="msg.metadata.activeBranch ?? 0"
    @change="(i) => (msg.metadata!.activeBranch = i)"
  >
    <MessageContent
      :content="msg.metadata.branches[msg.metadata.activeBranch ?? 0]"
    />
  </BranchPicker>
  <MessageContent v-else :content="msg.content" />
</template>
```

`content` 始终保存「当前生效」的分支内容（导出、复制、计费都读它）；`metadata.branches` 只是版本历史视图。重新生成时宿主把旧 `content` 推入 `branches`、追加新结果并更新 `activeBranch`。

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| branchCount | `number` | — | 分支总数（必填）；`<= 1` 时整体不渲染 |
| activeBranch | `number` | — | 当前分支（0-based，必填）；越界钳制 |
| showLabel | `boolean` | `true` | 是否显示「版本 n/total」标签 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| change | `(index: number)` | 翻页目标索引（0-based）；首/末端禁用不触发 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 当前分支内容，由宿主按 `activeBranch` 渲染 |
