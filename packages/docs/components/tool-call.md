# ToolCall 系列

工具调用可视化组件，展示 AI 调用工具的过程和结果。包含 5 个子组件：

- **ToolCall** — 可折叠容器（`<details>/<summary>`）
- **ToolCallHeader** — 状态图标 + 工具名 + 耗时
- **ToolCallContent** — 展开内容
- **ToolCallInput** — 格式化参数 JSON
- **ToolCallOutput** — 结果或错误

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
  status: 'calling' | 'completed' | 'error'
  duration?: number
}
```

## 状态样式

| 状态 | 图标 | 颜色 |
|------|------|------|
| calling | ⚡ | 黄色 |
| completed | ✓ | 绿色 |
| error | ✗ | 红色 |

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
