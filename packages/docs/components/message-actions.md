# MessageActions 预设操作四件

基于 [MessageAction](./message.md#messageaction)（30px 图标按钮）封装的四个预设操作：复制、重试、编辑、反馈。开箱即用图标与文案（i18n `messageActions.*`），省去每个宿主重复手写 svg 与交互状态。

```vue
<script setup lang="ts">
import {
  MessageActionCopy,
  MessageActionRetry,
  MessageActionEdit,
  MessageActionFeedback,
} from '@toimc/vue'
</script>
```

四个组件均渲染 MessageAction 基座（30px 图标按钮），可直接放进 `MessageActions` 行内组合使用。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import {
  MessageActions,
  MessageActionCopy,
  MessageActionEdit,
  MessageActionFeedback,
  MessageActionRetry,
} from '@toimc/vue'

type FeedbackValue = 'up' | 'down' | null

const answer = ref('这是 AI 的回答文本，可复制、可重试、可编辑重发。')
const retryCount = ref(0)
const feedbackValue = ref<FeedbackValue>(null)
const log = ref<string[]>([])

function onEdit(text: string) {
  answer.value = text
  log.value.unshift(`编辑重发：${text}`)
}

function onRetry() {
  retryCount.value++
  log.value.unshift('重试生成')
}

function onFeedback(v: FeedbackValue) {
  feedbackValue.value = v
  log.value.unshift(`反馈：${v ?? '已取消'}`)
}
</script>

把鼠标悬浮到消息上（`MessageActions` 的显隐跟随 `.ai-chat-message:hover`），体验四个预设操作的完整交互——复制有 ✓ 回显、编辑进入行内文本域、反馈可评论：

<DemoContainer>
  <div class="ai-chat-message" style="padding: 4px 0">
    <p style="margin: 0 0 4px">{{ answer }}</p>
    <MessageActions>
      <MessageActionCopy :text="answer" />
      <MessageActionRetry :disabled="retryCount >= 3" @retry="onRetry" />
      <MessageActionEdit :initial-text="answer" @edit="onEdit" />
      <MessageActionFeedback
        :value="feedbackValue"
        @change="onFeedback"
        @comment="(text: string) => log.unshift(`评论：${text}`)"
      />
    </MessageActions>
  </div>
  <p
    style="
      margin: 12px 0 0;
      font-size: 12px;
      color: var(--ai-chat-color-text-muted);
    "
  >
    重试 {{ retryCount }}/3 · 事件：{{ log.length ? log[0] : '（无）' }}
  </p>
</DemoContainer>

## MessageActionCopy 复制

内部走 `copyText`（`@toimc/core` 剪贴板降级链：`navigator.clipboard` → textarea + `execCommand`），复制成功后图标切换为 ✓，2 秒后回退；失败（非安全上下文等）保持原图标静默。

```vue
<MessageActionCopy :text="message.content" />
```

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| text | `string` | — | 待复制文本（必填） |
| tooltip | `string` | i18n `messageActions.copy` | 按钮提示文案 |

无自定义事件；复制结果只做图标回显，上报/toast 由宿主另行处理。

## MessageActionRetry 重试

语义对接 `ChatState.regenerate`——组件只 emit `retry`，重发请求由宿主绑定：

```vue
<MessageActionRetry :disabled="chat.status === 'streaming'" @retry="chat.regenerate()" />
```

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| disabled | `boolean` | `false` | 禁用（流式进行中建议禁用） |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| retry | — | 点击重试 |

## MessageActionEdit 行内编辑

铅笔按钮 → 点击展开编辑面板（textarea + 保存并重发 / 取消）。语义对接 `ChatState.editMessage`：

```vue
<MessageActionEdit
  :initial-text="message.content"
  @edit="(text) => chat.editMessage(message.id, text)"
  @cancel="() => {}"
/>
```

- 进入编辑时草稿从 `initialText` 重新起稿（半稿不跨会话残留）；保存 emit `edit`（trim 后非空才触发）、取消 emit `cancel`，两者都会收起面板。
- 面板出现在组件所在位置——放进消息内容位即可实现「原位编辑」，布局由宿主 slot 决定，组件不定位、不弹层。
- 保存成功后宿主更新消息内容时同步 `initialText`，下次进入编辑即为新内容。

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| initialText | `string` | — | 进入编辑的初始文本（必填） |
| placeholder | `string` | i18n `messageActions.editPlaceholder` | 编辑态占位 |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| edit | `(text: string)` | 保存并重发（trim 后非空才触发） |
| cancel | — | 取消编辑 |

## MessageActionFeedback 反馈

[MessageFeedback](./message-feedback.md) 的单行紧凑包装：👍/👎 + 点踩评论完整链路透传，适配操作按钮行——行本身已做 hover 显隐，包装内反馈按钮常显（透传 `data-always-visible`），评论框收窄为 280px。

```vue
<MessageActionFeedback
  :value="msg.feedback"
  @change="(v) => (msg.feedback = v)"
  @comment="(text) => submitFeedbackComment(msg.id, text)"
/>
```

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| value | `'up' \| 'down' \| null` | `null` | 受控反馈值（回显历史） |

| 事件名 | 参数 | 说明 |
|--------|------|------|
| change | `(value: 'up' \| 'down' \| null)` | toggle 语义：再点同值取消 |
| comment | `(text: string)` | 点踩评论提交（非空才触发） |

## 组合示例

```vue
<template>
  <Message from="assistant">
    <MessageContent :content="message.content" />
    <MessageActions>
      <MessageActionCopy :text="message.content" />
      <MessageActionRetry :disabled="chat.status !== 'idle'" @retry="chat.regenerate()" />
      <MessageActionFeedback
        :value="message.feedback"
        @change="(v) => (message.feedback = v)"
        @comment="(t) => submitComment(message.id, t)"
      />
    </MessageActions>
  </Message>
</template>
```

用户消息的编辑（原位替换内容区）：

```vue
<template>
  <Message from="user">
    <MessageActionEdit
      :initial-text="message.content"
      @edit="(text) => chat.editMessage(message.id, text)"
    />
  </Message>
</template>
```
