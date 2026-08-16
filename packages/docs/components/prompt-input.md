# PromptInput 系列

可组合的富输入系统，包含 10 个子组件：

- **PromptInput** — 外层容器，provide 输入上下文
- **PromptInputBody** — 输入行容器（Textarea 占满整行；横向内边距在此层统一提供）
- **PromptInputTextarea** — 弹性高度输入框：随内容自动增高，超过 `--ai-chat-input-max-height`（默认 200px）后内部滚动；键位模式由 PromptInput 的 `sendKey` 决定，粘贴文件进入附件管道
- **PromptInputSubmit** — 发送/停止按钮（圆形主题色，置于 Footer 右侧动作区）
- **PromptInputFooter** — 底部工具栏容器（左 tools / 右 hint 动作区）
- **PromptInputTools** — 工具按钮组
- **PromptInputButton** — 单个工具按钮
- **PromptInputUploadButton** — 图片/附件上传入口（触发文件选择管道）
- **PromptInputAttachments** — 待发送附件预览列表（图片缩略图 + Lightbox 兜底预览）
- **PromptInputHeader** — 顶部附件预览区域

## 基础用法

```vue
<PromptInput
  placeholder="输入消息..."
  @send="(payload) => chat.send(payload.text)"
>
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
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
        <PromptInputSubmit />
      </template>
      <template #hint>
        <span>Enter 换行，Alt+Enter 发送</span>
      </template>
    </PromptInputFooter>
  </template>
</PromptInput>
```

## 发送键位

`sendKey` 支持两种模式：

| 模式 | 发送 | 换行 | 适用场景 |
|------|------|------|----------|
| `'alt-enter'`（默认） | `Alt+Enter`（macOS 亦支持 `⌘+Enter`） | `Enter` | 长文输入为主，换行是高频操作（对齐 Claude/ChatGPT 桌面端） |
| `'enter'` | `Enter` | `Shift+Enter` | 短问答为主，发送是高频操作 |

```vue
<PromptInput send-key="enter" @send="onSend">
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
  <template #footer>
    <PromptInputFooter>
      <template #hint>
        <PromptInputSubmit />
      </template>
    </PromptInputFooter>
  </template>
</PromptInput>
```

两种模式下 IME 组合输入期间的 Enter（选字/确认候选词）均不会触发发送，中文/日文输入无渗字风险。

## 附件上传

附件有三个统一入口，全部走 PromptInput 的同一条校验管道（`accept` / `maxFiles` / `maxSize`）：

1. **按钮选择**：`PromptInputUploadButton`（`kind="image"` 限定图片，`kind="file"` 跟随 `accept`）
2. **粘贴**：在输入框内直接 `⌘V` / `Ctrl+V` 粘贴文件（如截图）
3. **拖拽**：拖动文件到输入框区域，边框高亮后松手

被管道拒绝的文件触发 `error` 事件并弹出内置 Toast 提示拒绝原因：

```vue
<PromptInput :before-send="upload" @send="onSend" @error="onError">
  <PromptInputAttachments />
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
  <template #footer>
    <PromptInputFooter>
      <template #tools>
        <PromptInputTools>
          <PromptInputUploadButton kind="image" />
          <PromptInputUploadButton kind="file" />
        </PromptInputTools>
      </template>
      <template #hint>
        <PromptInputSubmit />
      </template>
    </PromptInputFooter>
  </template>
</PromptInput>
```

### beforeSend 上传钩子

配置 `beforeSend` 后，发送时附件会先经过该钩子上传（期间附件项显示呼吸遮罩），resolve 返回的 `Attachment[]` 随 `send` 事件抛出；上传失败自动回置 `error` 态并 Toast：

```ts
import type { Attachment } from '@ai-chat/core'

async function upload(files: File[]): Promise<Attachment[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  return res.json()
}

function onSend(payload: { text: string; attachments?: Attachment[] }) {
  chat.send(payload.text, payload.attachments)
}
```

未配置 `beforeSend` 时，`send` 事件携带原始 `files: File[]`，上传逻辑完全交由宿主。

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

无自身 Props/Events。占位文本来自 `PromptInput` 的 `placeholder` prop；发送快捷键由 `PromptInput` 的 `sendKey` 决定，`send` 事件也在 `PromptInput` 上监听。粘贴图片/文件会自动进入附件预览列表。

### PromptInputSubmit

无 Props。**圆形主题色发送按钮**（`--ai-chat-color-accent` 背景 + 白色上箭头），置于 `PromptInputFooter` 的 `hint` 右侧动作区（输入框右下方）；流式输出中自动切换为停止方块，颜色跟随主题预设变化。

| 插槽名 | 说明 |
|--------|------|
| default | 自定义图标/内容（覆盖默认上箭头与停止方块） |

### PromptInputButton

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| title | `string` | — | 按钮 title |
| active | `boolean` | `false` | 激活状态 |

### PromptInputUploadButton

上传入口按钮，点击触发隐藏的 `<input type="file">`，选中文件走 PromptInput 的附件管道（accept / maxFiles / maxSize 校验）。`disabled` 跟随输入上下文。

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| kind | `'image' \| 'file'` | `'file'` | `image` 时 `accept` 固定为 `image/*`，`file` 时跟随 PromptInput 的 `accept` |

| 插槽名 | 说明 |
|--------|------|
| default | 按钮图标/内容 |

### PromptInputFooter

底部工具栏容器，左右分列。无 Props。

| 插槽名 | 说明 |
|--------|------|
| tools | 左侧工具区（通常放 `PromptInputTools` + 上传/功能按钮） |
| hint | 右侧动作区（常放 `PromptInputSubmit`，也可放提示文案） |

### PromptInputAttachments

待发送附件（pendingFiles）预览列表，通常放在 Textarea 上方。图片渲染 40px 缩略图，非图片按类型渲染图标占位（📄 文档 / 🎵 音频 / 🎬 视频）；`uploading` 态叠加呼吸遮罩，`error` 态红色边框且 `title` 显示错误信息；每项带文件名（单行省略）、大小与移除按钮。

图片点击预览走兜底链：宿主监听 `preview` 事件时只抛出事件、不弹内置预览；未监听则打开内置 `ImageLightbox`（Esc 关闭、左右方向键翻页）。

```vue
<PromptInput v-model="..." @send="...">
  <PromptInputAttachments />
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
</PromptInput>
```

| 事件名 | 参数 | 说明 |
|--------|------|------|
| preview | `(payload: { attachments: Attachment[]; index: number })` | 宿主接管图片预览时触发；`attachments` 为当前全部图片（含 id/name/mediaType/url/size），`index` 指向被点击项 |
