# ToolConfirmation 工具审批

工具调用的人工审批组件。当工具状态为 `awaiting-approval`（等待人工确认）时展示参数摘要与允许/拒绝按钮，宿主决定审批结果如何回传后端。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import { Button, ToolConfirmation } from '@toimc/vue'

const status = ref<'awaiting-approval' | 'denied'>('awaiting-approval')
const decision = ref('等待审批……')

function onApprove() {
  decision.value = '已允许：宿主把审批结果回传后端，工具状态推进到 calling'
}

function onReject() {
  status.value = 'denied'
  decision.value = '已拒绝：组件转为只读回退态，按钮组隐藏'
}

function reset() {
  status.value = 'awaiting-approval'
  decision.value = '等待审批……'
}
</script>

点击「允许 / 拒绝」体验两态流转；拒绝后组件进入只读态，可重置演示反复体验：

<DemoContainer>
  <ToolConfirmation
    tool-name="delete_file"
    :arguments="{ path: '/tmp/lock.db', force: true }"
    reason="该操作会删除文件，且不可恢复"
    :status="status"
    @approve="onApprove"
    @reject="onReject"
  />
  <p
    style="
      margin: 12px 0 0;
      font-size: 12px;
      color: var(--ai-chat-color-text-muted);
    "
  >
    {{ decision }}
  </p>
  <div v-if="status === 'denied'" style="margin-top: 8px">
    <Button type="secondary" size="small" @click="reset">重置演示</Button>
  </div>
</DemoContainer>

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ToolConfirmation } from '@toimc/vue'

const status = ref<'awaiting-approval' | 'denied'>('awaiting-approval')

function onApprove() {
  // 宿主回传审批结果给后端，成功后自行把工具状态推进到 calling
}
function onReject() {
  status.value = 'denied'
}
</script>

<template>
  <ToolConfirmation
    tool-name="delete_file"
    :arguments="{ path: '/tmp/lock.db' }"
    reason="该操作会删除文件，且不可恢复"
    :status="status"
    @approve="onApprove"
    @reject="onReject"
  />
</template>
```

## 两态行为

| status | 表现 |
|--------|------|
| `awaiting-approval` | warning 描边卡片：标题 + 审批说明 + 工具名 + 参数 JSON + 允许/拒绝按钮 |
| `denied` | 只读回退：隐藏按钮组，显示「已拒绝」状态；工具名与参数保留可回溯 |

## 安全说明

- 参数渲染走 `JSON.stringify` + 文本插值（textContent），**无 v-html**——工具参数是不可信输入，不进 HTML 管道
- 不可序列化入参（循环引用等）兜底为 `String()`，不抛渲染错误
- `arguments` 缺省时不渲染参数区，空对象显示 `{}`

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| toolName | `string` | — | 工具名（必填） |
| arguments | `Record<string, unknown>` | — | 参数摘要（JSON 格式化只读展示） |
| reason | `string` | i18n `confirmation.description` | 审批说明（为何需要确认） |
| status | `'awaiting-approval' \| 'denied'` | — | 审批状态（必填） |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| approve | — | 点击「允许」 |
| reject | — | 点击「拒绝」 |

审批回传协议（approve/reject 如何到达后端）本期未接入 adapter，由宿主在事件回调中自行处理；与 [ToolCall](/components/tool-call) 六态徽章配合使用时，建议放进 ToolCall 的 default 作用域插槽。
