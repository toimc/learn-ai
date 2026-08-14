# Message 系列

消息渲染组件，包含头像、内容和操作按钮。包含 5 个子组件：

- **Message** — 消息项，根据 `from` 区分用户/助手样式
- **MessageContent** — 消息正文容器
- **MessageActions** — 操作按钮容器（hover 显示）
- **MessageAction** — 单个操作按钮
- **MessageAttachments** — 附件容器

## 基础用法

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <Message from="user">
      <MessageContent>你好，请帮我写一段代码</MessageContent>
    </Message>
    <Message from="assistant">
      <MessageContent>好的，这是你要的代码示例。</MessageContent>
      <MessageActions>
        <MessageAction title="复制">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </MessageAction>
      </MessageActions>
    </Message>
  </div>
</DemoContainer>

## API

### Message

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| from | `'user' \| 'assistant' \| 'system'` | — | 消息角色（必填） |

消息的水平对齐由父级 `Conversation` 的 `layout` / `messageAlign` 控制（经 provide/inject 下发）：

- `layout='stacked'`（默认）：保持现状，所有消息统一靠左。
- `layout='im'`：用户消息与 AI 消息分列两侧，单条气泡限宽 `--ai-chat-message-max-width`（默认 480px）；`messageAlign` 决定用户消息停靠侧，AI 在对侧。

未检测到布局上下文时回退现状布局，向后兼容。

### MessageContent

无 Props。slot 放消息正文。

### MessageActions

无 Props。默认 `opacity: 0`，父级 `.ai-chat-message` hover 时显示。

### MessageAction

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| title | `string` | — | 按钮 title 属性 |

| 插槽名 | 说明 |
|--------|------|
| default | 按钮图标/内容 |

| 事件名 | 说明 |
|--------|------|
| click | 按钮点击 |
