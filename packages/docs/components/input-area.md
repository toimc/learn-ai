# InputArea

> ⚠️ **已废弃**：请迁移到 [PromptInput](/components/prompt-input)。本组件保留导出仅为向后兼容。

文本输入区域，支持发送和中止两种模式。按下 Enter 发送消息，流式输出时切换为中止按钮。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'

const lastSent = ref('')
const aborted = ref(false)

function onSend(content: string) {
  lastSent.value = content
}
</script>

按 Enter 发送（Shift+Enter 换行）。Best for：旧版简单聊天输入，新代码请用 [PromptInput](/components/prompt-input)。

<DemoContainer>
  <div>
    <InputArea @send="onSend" />
    <p v-if="lastSent" style="margin-top: 8px; color: #666; font-size: 14px">
      已发送: {{ lastSent }}
    </p>
  </div>
</DemoContainer>

## 禁用状态（流式中）

当 `disabled` 为 `true` 时，发送按钮变为中止按钮，点击触发 `abort`。Best for：流式输出进行中，允许用户随时打断：

<DemoContainer>
  <div>
    <InputArea disabled @abort="aborted = true" />
    <p
      v-if="aborted"
      style="margin-top: 8px; color: #666; font-size: 14px"
    >
      已中止生成，恢复后按钮切回发送态
    </p>
  </div>
</DemoContainer>

## 自定义占位文本

```vue
<InputArea placeholder="输入你的问题..." @send="handleSend" />
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| disabled | `boolean` | `false` | 禁用输入，显示中止按钮 |
| placeholder | `string` | `'Type a message...'` | 输入框占位文本 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| send | `(content: string)` | 用户提交文本 |
| abort | — | 用户点击中止按钮 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| prepend | 输入行之前的内容（如附件按钮） |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-border-color | `#e5e7eb` | 输入框边框颜色 |
| --ai-chat-radius | `8px` | 输入框圆角 |
| --ai-chat-input-bg | `#ffffff` | 输入框背景 |
| --ai-chat-input-color | `#1f2937` | 输入框文字 |
| --ai-chat-primary | `#2563eb` | 主色调（发送按钮） |
| --ai-chat-danger | `#ef4444` | 警告色（中止按钮） |
