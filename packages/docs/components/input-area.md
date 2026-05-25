# InputArea

文本输入区域，支持发送和中止两种模式。按下 Enter 发送消息，流式输出时切换为中止按钮。

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'

const lastSent = ref('')
function onSend(content: string) {
  lastSent.value = content
}
</script>

<DemoContainer>
  <div>
    <InputArea @send="onSend" />
    <p v-if="lastSent" style="margin-top: 8px; color: #666; font-size: 14px">
      已发送: {{ lastSent }}
    </p>
  </div>
</DemoContainer>

## 禁用状态（流式中）

当 `disabled` 为 `true` 时，发送按钮变为中止按钮：

<DemoContainer>
  <InputArea disabled @abort="() => console.log('aborted')" />
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
