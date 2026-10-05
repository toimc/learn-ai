# MessageFeedback 消息反馈

消息级 👍/👎 反馈组件：点赞/点踩 toggle → 点踩后出现「帮助我们改进 →」弱提示 → 展开评论输入框（提交/取消）。纯 UI 状态组件，不持有任何 API——反馈的持久化、上报失败静默等由宿主处理。

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MessageFeedback } from '@toimc/vue'

const feedback = ref<'up' | 'down' | null>(null)

function onChange(value: 'up' | 'down' | null) {
  feedback.value = value
  // 宿主持久化；上报失败静默，不打断对话
}

function onComment(text: string) {
  // 宿主提交评论
}
</script>

<template>
  <MessageFeedback
    :value="feedback"
    @change="onChange"
    @comment="onComment"
  />
</template>
```

交互三段节奏：

1. **toggle**：点 👍/👎 生效；再点同值取消（`change` 传 `null`），点另一个则切换。
2. **弱提示**：点踩后出现「帮助我们改进 →」文字按钮，不自动展开评论框，由用户点击触发。
3. **评论框**：textarea + 提交/取消。提交只对非空文本 emit `comment`，emit 后本地清空并收起；取消直接收起并清空。

未反馈时按钮 hover/键盘聚焦才显示（`visibility` 切换，布局不跳动）；已有反馈时常显。放在已自带 hover 显隐的容器（如 `MessageActions` 行）内时，透传 `data-always-visible` 让按钮常显：

```vue
<MessageFeedback data-always-visible />
```

`value` 为受控回显口：传入历史反馈值（`'up'` / `'down'` / `null`）即同步显示；宿主撤销反馈时传回 `null`。评论框内的草稿不回显——历史评论文案由宿主自行渲染。

不需要评论能力时关闭两级展开：

```vue
<MessageFeedback :allow-comment="false" />
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| value | `'up' \| 'down' \| null` | `null` | 受控反馈值（回显历史），`null` = 无反馈 |
| allowComment | `boolean` | `true` | 点踩后是否允许展开评论框 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| change | `(value: 'up' \| 'down' \| null)` | toggle 语义：再点同值取消（`null`） |
| comment | `(text: string)` | 评论提交，非空才触发；emit 后组件清空草稿并收起 |

### 状态样式

| 状态 | 样式 |
|------|------|
| 点赞激活 | 主题色（accent） |
| 点踩激活 | 警告色（status-warning） |
| 未反馈 | muted 灰，hover 显主文本色 |

## 在动作行中使用

紧凑单行形态见 [MessageActionFeedback](./message-actions.md#messageactionfeedback)，它包装本组件并适配操作按钮行的布局与显隐节奏。
