# ToolCall 系列

工具调用可视化组件，展示 AI 调用工具的过程和结果。包含 6 个子组件：

- **ToolCall** — 可折叠容器（`<details>/<summary>`）
- **ToolCallHeader** — 六态状态徽章 + 工具名 + 耗时
- **ToolCallContent** — 展开内容
- **ToolCallInput** — 格式化参数 JSON
- **ToolCallOutput** — 结果或错误
- **ToolConfirmation** — 人工审批卡片（见 [ToolConfirmation 文档](/components/tool-confirmation)）

## 代码演示

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ToolCallInfo, ToolCallStatus } from '@toimc/core'
import { Button, ToolCall } from '@toimc/vue'

const STATUSES: ToolCallStatus[] = [
  'pending',
  'calling',
  'awaiting-approval',
  'completed',
  'denied',
  'error',
]

const currentStatus = ref<ToolCallStatus>('completed')

const baseCall = {
  id: 'call_1',
  name: 'search_docs',
  arguments: { query: '流式渲染', topK: 5 },
}

const interactiveData = computed<ToolCallInfo>(() => ({
  ...baseCall,
  status: currentStatus.value,
  duration: currentStatus.value === 'pending' ? undefined : 1240,
  result:
    currentStatus.value === 'completed' || currentStatus.value === 'denied'
      ? { hits: 3, sources: ['17-03 记忆系统', '10-02 core 层'] }
      : undefined,
  error: currentStatus.value === 'error' ? '上游文档服务超时（504）' : undefined,
}))

const pendingCall: ToolCallInfo = {
  id: 'call_2',
  name: 'search_docs',
  arguments: { query: '流式渲染', topK: 5 },
  status: 'pending',
}

const callingCall: ToolCallInfo = {
  id: 'call_3',
  name: 'get_weather',
  arguments: { city: 'Beijing', unit: 'celsius' },
  status: 'calling',
  duration: 800,
}

const approvalCall: ToolCallInfo = {
  id: 'call_4',
  name: 'delete_file',
  arguments: { path: '/tmp/lock.db', force: true },
  status: 'awaiting-approval',
}

const completedCall: ToolCallInfo = {
  id: 'call_5',
  name: 'search_docs',
  arguments: { query: '流式渲染', topK: 5 },
  status: 'completed',
  duration: 1240,
  result: { hits: 3, sources: ['17-03 记忆系统', '10-02 core 层'] },
}

const deniedCall: ToolCallInfo = {
  id: 'call_6',
  name: 'send_email',
  arguments: { to: 'team@example.com', subject: '周报' },
  status: 'denied',
  duration: 2100,
}

const errorCall: ToolCallInfo = {
  id: 'call_7',
  name: 'search_docs',
  arguments: { query: '流式渲染', topK: 5 },
  status: 'error',
  duration: 5000,
  error: '上游文档服务超时（504）',
}
</script>

### 六态切换

点击按钮切换状态，展开卡片查看参数与结果随状态的变化：

<DemoContainer>
  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px">
    <Button
      v-for="s in STATUSES"
      :key="s"
      size="small"
      :type="currentStatus === s ? 'primary' : 'secondary'"
      @click="currentStatus = s"
    >
      {{ s }}
    </Button>
  </div>
  <ToolCall :data="interactiveData" />
</DemoContainer>

### pending

排队或参数流式组装中，无耗时信息——适合让用户知道「请求已受理」：

<DemoContainer>
  <ToolCall :data="pendingCall" />
</DemoContainer>

### calling

执行中，warning 色 + 脉冲动画给「正在跑」的感知，`duration` 实时跳动：

<DemoContainer>
  <ToolCall :data="callingCall" />
</DemoContainer>

### awaiting-approval

等待人工审批，配合 [ToolConfirmation](./tool-confirmation.md) 放进 default 插槽提供允许/拒绝按钮：

<DemoContainer>
  <ToolCall :data="approvalCall" />
</DemoContainer>

### completed

正常完成，参数与结果并排可审计——最常见形态：

<DemoContainer>
  <ToolCall :data="completedCall" />
</DemoContainer>

### denied

用户拒绝后的只读回溯，工具名与参数保留可查：

<DemoContainer>
  <ToolCall :data="deniedCall" />
</DemoContainer>

### error

失败态，`error` 字段的错误信息帮助排查：

<DemoContainer>
  <ToolCall :data="errorCall" />
</DemoContainer>

## 状态样式（六态徽章）

对齐 AI SDK 工具生命周期的六态状态机；旧三值（calling/completed/error）语义不变：

| 状态 | 图标 | 颜色 | i18n key | 说明 |
|------|------|------|----------|------|
| pending | ⏳ | muted | `toolCall.statusPending` | 排队/参数流式组装中 |
| calling | ⚡（脉冲动画） | warning | `toolCall.statusCalling` | 执行中 |
| awaiting-approval | ⛨ | warning | `toolCall.statusAwaitingApproval` | 等待人工审批（标签走 warning 描边） |
| completed | ✓ | success | `toolCall.statusCompleted` | 完成 |
| denied | ⊘ | warning 系 | `toolCall.statusDenied` | 用户拒绝 |
| error | ✗ | error | `toolCall.statusError` | 失败 |

状态标签随 `aiChatI18n` 语言切换；calling 的脉冲动画在 `prefers-reduced-motion: reduce` 下关闭。

## ToolCallInfo 类型

```typescript
interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  status: ToolCallStatus // 六态枚举，见上表
  duration?: number
}
```

## API

### ToolCall

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| data | `ToolCallInfo` | — | 工具调用数据（必填） |

| 插槽名 | 作用域 | 说明 |
|--------|--------|------|
| header | `{ data, open }` | 自定义头部 |
| default | `{ data }` | 自定义内容 |

其他子组件（Header/Content/Input/Output）通过 inject 从 ToolCall 获取数据。
