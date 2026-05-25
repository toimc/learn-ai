# PromptInput 系列

可组合的富输入系统，包含 8 个子组件：

- **PromptInput** — 外层容器，provide 输入上下文
- **PromptInputTextarea** — 自适应高度输入框（Enter 发送 / Shift+Enter 换行）
- **PromptInputSubmit** — 发送/停止按钮
- **PromptInputBody** — 输入行容器
- **PromptInputFooter** — 底部工具栏容器
- **PromptInputTools** — 工具按钮组
- **PromptInputButton** — 单个工具按钮
- **PromptInputHeader** — 顶部附件预览区域

## 基础用法

```vue
<PromptInput>
  <PromptInputTextarea
    placeholder="输入消息..."
    @send="(text) => chat.send(text)"
  />
  <PromptInputSubmit />
  <template #footer>
    <PromptInputFooter>
      <template #tools>
        <PromptInputTools>
          <PromptInputButton title="上传">
            <!-- 图标 -->
          </PromptInputButton>
        </PromptInputTools>
      </template>
      <template #hint>
        <span>Enter 发送，Shift+Enter 换行</span>
      </template>
    </PromptInputFooter>
  </template>
</PromptInput>
```

## API

### PromptInput

无 Props。provide 输入上下文给子组件。

| 插槽名 | 说明 |
|--------|------|
| default | 输入主体（Textarea + Submit） |
| footer | 底部工具栏 |

### PromptInputTextarea

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| placeholder | `string` | `'Type a message...'` | 输入框占位文本 |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| send | `(content: string)` | 用户按 Enter 提交 |

### PromptInputSubmit

无 Props。自动根据流式状态切换发送/停止图标。

### PromptInputButton

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| title | `string` | — | 按钮 title |
| active | `boolean` | `false` | 激活状态 |
