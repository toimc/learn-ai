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

provide 输入上下文给子组件，并承载附件管道（选择 / 粘贴 / 拖拽上传）。

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| disabled | `boolean` | `false` | 禁用输入与发送 |
| placeholder | `string` | `'给 AI Chat UI 发送消息...'` | 输入框占位文本 |
| maxHeight | `number` | `200` | 输入框最大高度（px） |
| accept | `string` | `''` | 允许的文件类型（同 `<input accept>`），空为不限 |
| multiple | `boolean` | `false` | 是否允许多文件 |
| maxFiles | `number` | `5` | 附件数量上限 |
| maxSize | `number` | — | 单文件大小上限（字节） |
| sendKey | `'alt-enter' \| 'enter'` | `'alt-enter'` | 发送快捷键，Enter 发送时换行需 Shift+Enter |
| beforeSend | `(files: File[]) => Promise<Attachment[]>` | — | 发送前上传钩子；resolve 的 attachments 随 `send` 事件抛出 |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| send | `(payload: { text: string; files?: File[]; attachments?: Attachment[] })` | 提交消息；无 beforeSend 时携带原始 `files`，有则携带上传后的 `attachments` |
| abort | `()` | 点击停止按钮 |
| error | `(payload: { files: File[]; reason: string })` | 附件校验拒绝 / 上传失败 |

响应式：容器宽度 < 640px（容器查询）时自动紧凑——减小外边距并隐藏底部 disclaimer；输入框 `max-height` 跟随 `--ai-chat-input-max-height`（桌面 200px），窄屏可由 `--ai-chat-input-max-height-mobile`（默认 120px）覆盖收窄。

#### 拖拽上传

拖动文件到输入框区域（`__wrapper`）时高亮边框，松手即走与文件选择相同的校验管道（accept / maxFiles / maxSize），被拒文件触发 `error` 事件并弹出 Toast。非文件拖拽（如拖选文本）不响应。

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
