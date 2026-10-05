# ToolCall 系列

工具调用可视化组件，展示 AI 调用工具的过程和结果。包含 6 个子组件：

- **ToolCall** — 可折叠容器（`<details>/<summary>`）
- **ToolCallHeader** — 六态状态徽章 + 工具名 + 耗时
- **ToolCallContent** — 展开内容
- **ToolCallInput** — 格式化参数 JSON
- **ToolCallOutput** — 结果或错误
- **ToolConfirmation** — 人工审批卡片（见 [ToolConfirmation 文档](/components/tool-confirmation)）

## 基础用法

```vue
<ToolCall :data="toolCallInfo" />
```

`ToolCallInfo` 类型：

```typescript
interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
  status: ToolCallStatus // 六态枚举，见下表
  duration?: number
}
```

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
