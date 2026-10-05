# PromptInput 系列

可组合的富输入系统，包含 11 个子组件：

- **PromptInput** — 外层容器，provide 输入上下文
- **PromptInputBody** — 输入行容器（Textarea 占满整行；横向内边距在此层统一提供）
- **PromptInputTextarea** — 弹性高度输入框：随内容自动增高，超过 `--ai-chat-input-max-height`（默认 200px）后内部滚动；键位模式由 PromptInput 的 `sendKey` 决定，粘贴文件进入附件管道
- **PromptInputSubmit** — 发送/停止按钮（圆形主题色，置于 Footer 右侧动作区）
- **PromptInputFooter** — 底部工具栏容器（左 tools / 右 hint 动作区）
- **PromptInputTools** — 工具按钮组
- **PromptInputButton** — 单个工具按钮。按钮宽度自适应：只放图标时保持 32px 方形；放文字（快捷指令 chip）时按内容自然撑开，不换行
- **PromptInputUploadButton** — 图片/附件上传入口（触发文件选择管道）
- **PromptInputAttachments** — 待发送附件预览列表（图片缩略图 + Lightbox 兜底预览）
- **PromptInputHeader** — 顶部附件预览区域
- **PromptInputSuggestion** — 输入内联建议浮层（`/`、`@` 触发唤起，↑↓/Enter/Esc 键盘交互；受控设计，详见 [PromptInputSuggestion](./prompt-input-suggestion.md)）

## 代码演示

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import type { Attachment } from '@toimc/core'
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputUploadButton,
  PromptInputAttachments,
  PromptInputSubmit,
} from '@toimc/vue'

const sentLog = ref<{ text: string; attachments: number }[]>([])

async function fakeUpload(files: File[]): Promise<Attachment[]> {
  // 模拟宿主上传接口：600ms 延迟期间附件项显示呼吸遮罩
  await new Promise((resolve) => setTimeout(resolve, 600))
  return files.map((f, i) => ({
    id: `up-${Date.now()}-${i}`,
    name: f.name,
    mediaType: f.type || 'application/octet-stream',
    size: f.size,
    url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
  }))
}

function onSendWithUpload(payload: { text: string; attachments?: Attachment[] }) {
  sentLog.value = [
    {
      text: payload.text || '（空文本）',
      attachments: payload.attachments?.length ?? 0,
    },
    ...sentLog.value,
  ].slice(0, 3)
}

const streaming = ref(false)
const replyText = ref('')
const FULL_REPLY =
  '收到。这是一段模拟的流式回复——真实场景由适配器 yield 的 text chunk 逐块追加；流式期间输入区右下角的发送按钮切换为停止方块，点击可随时中断。'

let replyTimer: ReturnType<typeof setInterval> | undefined

function onSendStream(payload: { text: string }) {
  replyText.value = ''
  streaming.value = true
  replyTimer = setInterval(() => {
    replyText.value = FULL_REPLY.slice(0, replyText.value.length + 2)
    if (replyText.value.length >= FULL_REPLY.length) stopStreaming(true)
  }, 50)
}

function stopStreaming(finished = false) {
  streaming.value = false
  if (replyTimer) {
    clearInterval(replyTimer)
    replyTimer = undefined
  }
  if (!finished && replyText.value) replyText.value += '（已中断）'
}

// 流式期间点击停止方块：捕获阶段拦截，不再触发内部 submit
function onStopClick(e: MouseEvent) {
  if (!streaming.value) return
  e.preventDefault()
  e.stopPropagation()
  stopStreaming()
}

onUnmounted(() => {
  if (replyTimer) clearInterval(replyTimer)
})
</script>

### 空态

对话入口的首屏形态：只有占位文本与发送按钮，聚焦即输入（默认键位 `Alt+Enter` 发送、`Enter` 换行）：

<DemoContainer>
  <PromptInput placeholder="给 AI Chat UI 发送消息…">
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
</DemoContainer>

### 输入中（附件预览与发送）

完整输入区：键入多行文本观察弹性增高；附件有上传按钮 / 粘贴 / 拖拽三个入口（`multiple`，至多 3 个），发送走 `beforeSend` 上传钩子——上传期间附件项呈呼吸遮罩，完成后 `send` 事件携带上传产物：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <PromptInput
      multiple
      :max-files="3"
      :before-send="fakeUpload"
      @send="onSendWithUpload"
    >
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
    <p
      v-if="sentLog.length"
      style="margin: 0; font-size: 12px; color: var(--ai-chat-color-text-muted)"
    >
      最近发送：
      <span v-for="(s, i) in sentLog" :key="i">
        「{{ s.text }}」（附件 {{ s.attachments }} 个）{{ i < sentLog.length - 1 ? '；' : '' }}
      </span>
    </p>
  </div>
</DemoContainer>

### 流式中（发送 / 停止切换）

发送后进入模拟流式回复，右下角按钮切换为停止方块，点击随时中断：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <PromptInput @send="onSendStream">
      <PromptInputBody>
        <PromptInputTextarea />
      </PromptInputBody>
      <template #footer>
        <PromptInputFooter>
          <template #hint>
            <span style="display: inline-flex" @click.capture="onStopClick">
              <PromptInputSubmit>
                <svg v-if="streaming" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </PromptInputSubmit>
            </span>
          </template>
        </PromptInputFooter>
      </template>
    </PromptInput>
    <p
      v-if="streaming || replyText"
      style="
        margin: 0;
        font-size: 13px;
        line-height: 1.7;
        color: var(--ai-chat-color-text-primary);
      "
    >
      <strong style="color: var(--ai-chat-color-accent)">AI</strong>
      {{ replyText }}{{ streaming ? '▌' : '' }}
    </p>
  </div>
</DemoContainer>

真实接线中，按钮由 `PromptInput` 输入上下文的 `status` 驱动、在发送与停止间自动切换（停止点击发出 `abort` 事件交宿主中断流）；本演示以默认插槽自绘两态图标模拟该切换。

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
          <PromptInputButton tooltip="上传">
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
import type { Attachment } from '@toimc/core'

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
| placeholder | `string` | i18n `promptInput.placeholder` | 输入框占位文本 |
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
| abort | `()` | 点击停止按钮；由内部 `status` 驱动，当前无公开驱动入口（见下方 PromptInputSubmit 注记） |
| error | `(payload: { files: File[]; reason: string })` | 附件校验拒绝 / 上传失败 |

响应式：容器宽度 < 640px（容器查询）时自动紧凑——减小外边距并隐藏底部 disclaimer；输入框 `max-height` 跟随 `--ai-chat-input-max-height`（桌面 200px），窄屏可由 `--ai-chat-input-max-height-mobile`（默认 120px）覆盖收窄。

#### 拖拽上传

拖动文件到输入框区域（`__wrapper`）时高亮边框，松手即走与文件选择相同的校验管道（accept / maxFiles / maxSize），被拒文件触发 `error` 事件并弹出 Toast。非文件拖拽（如拖选文本）不响应。

| 插槽名 | 说明 |
|--------|------|
| default | 输入主体（Textarea + Submit） |
| footer | 底部工具栏 |
| disclaimer | 底部免责声明文案，缺省渲染 i18n `promptInput.disclaimer`（窄屏自动隐藏） |

### PromptInputTextarea

无自身 Props/Events。占位文本来自 `PromptInput` 的 `placeholder` prop；发送快捷键由 `PromptInput` 的 `sendKey` 决定，`send` 事件也在 `PromptInput` 上监听。粘贴图片/文件会自动进入附件预览列表。

### PromptInputSubmit

无 Props。**圆形主题色发送按钮**（`--ai-chat-color-accent` 背景 + 白色上箭头），置于 `PromptInputFooter` 的 `hint` 右侧动作区（输入框右下方）；颜色跟随主题预设变化。

| 插槽名 | 说明 |
|--------|------|
| default | 自定义图标/内容（覆盖默认上箭头） |

::: warning status 尚无公开驱动入口
按钮的发送/停止两态由 PromptInput 输入上下文的内部 `status`（`'ready' | 'streaming'`）驱动，但当前版本 **PromptInput 未暴露 `status` / `streaming` prop**，`status` 恒为 `'ready'`——停止方块与 `abort` 事件从公开 API 侧不可达。流式中需切换停止按钮时，按上方「流式中」演示的做法：默认插槽自绘两态图标 + `@click.capture` 拦截后自行中断。
:::

### PromptInputButton

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| tooltip | `string` | `''` | 悬停提示（写入按钮 `title`） |
| active | `boolean` | `false` | 激活状态 |
| disabled | `boolean` | `false` | 禁用按钮 |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| click | `()` | 点击按钮 |

### PromptInputUploadButton

上传入口按钮，点击触发隐藏的 `<input type="file">`，选中文件走 PromptInput 的附件管道（accept / maxFiles / maxSize 校验）。`disabled` 跟随输入上下文。

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| kind | `'image' \| 'file'` | `'file'` | `image` 时 `accept` 固定为 `image/*`，`file` 时跟随 PromptInput 的 `accept` |

| 插槽名 | 说明 |
|--------|------|
| default | 按钮图标/内容 |

### PromptInputMicButton

语音输入按钮（内部接 [`useSpeechInput`](/guide/speech)），放在 PromptInput 工具区即可获得完整语音输入体验。**特性检测驱动显隐**：Chrome/Edge 显示，Firefox 等不支持时整颗按钮不渲染。

```vue
<PromptInputTools>
  <PromptInputMicButton />
  <PromptInputUploadButton kind="image" />
</PromptInputTools>
```

行为链路：点击开始录音（按钮 accent 色 + 脉冲动效），识别文本实时显示在按钮上方字幕浮层；再次点击（或单句模式说完自动停）结束录音，**最终识别文本追加进输入框**——语音识别不是 100% 准，落输入框供确认编辑再发送。识别错误（没听到语音 / 麦克风权限被拒）在字幕浮层显示翻译后的人话文案。

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| lang | `string` | `'zh-CN'` | 识别语言（BCP-47） |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| transcribed | `(text: string)` | 录音结束且识别文本已追加进输入框（无识别结果不触发） |

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
