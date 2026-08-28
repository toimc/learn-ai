# Message 系列

消息渲染组件，包含 5 个子组件：

- **Message** — 消息项，根据 `from` 区分用户/助手样式
- **MessageContent** — 消息正文容器（支持 thinking / streaming）
- **MessageActions** — 操作按钮容器（hover 显示）
- **MessageAction** — 单个操作按钮
- **MessageAttachments** — 附件容器

## 基础用法

用户消息直接走默认插槽；AI 消息传 `content` prop 走 Markdown 渲染（需在应用入口 `app.provide(markdownRendererKey, MarkdownRenderer)`）。`MessageActions` 默认透明，hover 到消息时浮现：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <Message from="user">
      <MessageContent>你好，请帮我写一段代码</MessageContent>
    </Message>
    <Message from="assistant">
      <MessageContent content="好的，这是一个 **TypeScript** 异步生成器示例，`for await` 逐块消费流。" />
      <MessageActions>
        <MessageAction title="复制">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </MessageAction>
        <MessageAction title="重新生成">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </MessageAction>
      </MessageActions>
    </Message>
  </div>
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<template>
  <Message from="user">
    <MessageContent>你好，请帮我写一段代码</MessageContent>
  </Message>

  <Message from="assistant">
    <MessageContent :content="message.content" />
    <MessageActions>
      <MessageAction title="复制" @click="copy">
        <!-- 复制图标 -->
      </MessageAction>
      <MessageAction title="重新生成" @click="regenerate">
        <!-- 重新生成图标 -->
      </MessageAction>
    </MessageActions>
  </Message>
</template>
```

</details>

## 消息角色

`from` 属性三种取值对应不同视觉：`user` 用户提问、`assistant` AI 回复（带头像）、`system` 系统提示（弱化样式）：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px;">
    <Message from="user">
      <MessageContent>用一句话说明 Composition API 解决了什么问题</MessageContent>
    </Message>
    <Message from="assistant">
      <MessageContent content="Composition API 让逻辑按**功能**聚合而不是按选项类型分散，解决了大型组件中相关代码被切碎、难以复用的问题。" />
    </Message>
    <Message from="system">
      <MessageContent>已切换到简洁回答模式：优先给结论，必要时补充示例。</MessageContent>
    </Message>
  </div>
</DemoContainer>

消息的水平对齐由父级 `Conversation` 的 `layout` / `messageAlign` 控制（详见 [Conversation 文档](/components/conversation#消息布局)）。

## 思考过程

`MessageContent` 传入 `thinking` 后，消息顶部展示折叠式思考块。点击下方按钮体验完整的流式生命周期 —— **正在思考…（内容实时展开，可随时手动折叠）→ 正文开始流式时思考块自动收起为「已思考 X 秒」（思考光标消失，光标只跟正文走）**：

<DemoContainer>
  <ThinkingMessageDemo />
</DemoContainer>

思考内容由 `useChat` 消费 `thinking` chunk 自动累积，思考结束于**首个正文/工具帧到达**（此刻收尾 `active` 并就地计算耗时，`done` 帧与中断路径兜底），无需手动维护：

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Message, MessageContent } from '@toimc/vue'

const streaming = ref(true)
const message = ref({
  content: '',
  thinking: {
    content: '正在分析用户的请求…\n拆解为关键概念…',
    duration: 4210, // done 时由 useChat 自动计算
  },
})
</script>

<template>
  <Message from="assistant">
    <MessageContent
      :content="message.content"
      :thinking="message.thinking"
      :streaming="streaming"
    />
  </Message>
</template>
```

</details>

适配器侧只需按顺序 yield `thinking` 与 `text` chunk：

```typescript
async *sendMessage({ messages, signal }) {
  yield { type: 'thinking', content: '正在分析用户请求...\n' }
  yield { type: 'thinking', content: '拆解问题为关键概念...\n' }
  yield { type: 'text', content: '根据分析，这里是关键概念：' }
  yield { type: 'done', content: '' } // 触发耗时计算并折叠
}
```

## A/B 回复对比

服务端响应可在 `Message` 上携带 `comparison` 载荷，渲染层据此显示 [`ComparisonMessage`](/components/comparison-message) 对比卡；点「喜欢这个」后选中内容**原地固化**为普通 AI 消息（`content` 被写入、载荷被清除），可点「重置演示」反复体验：

<DemoContainer>
  <ComparisonFlowDemo />
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import type { Message } from '@toimc/core'
import { Message, MessageContent, ComparisonMessage } from '@toimc/vue'

function onPrefer(
  msg: Message,
  p: { chosen: 'A' | 'B'; left: string; right: string },
) {
  // 原地固化：状态存于消息本身，切换会话不丢失
  msg.content = p.chosen === 'A' ? p.left : p.right
  msg.comparison = undefined
}
</script>

<template>
  <Message v-for="msg in messages" :key="msg.id" :from="msg.role">
    <ComparisonMessage
      v-if="msg.comparison"
      :left="msg.comparison.left"
      :right="msg.comparison.right"
      :left-label="msg.comparison.leftLabel"
      :right-label="msg.comparison.rightLabel"
      @prefer="(p) => onPrefer(msg, p)"
    />
    <MessageContent v-else :content="msg.content" />
  </Message>
</template>
```

</details>

## 附件消息

`MessageAttachments` 作为附件容器放在正文上方或下方，内部用 [Attachment 系列](/components/attachments) 渲染每个附件：图片走缩略图，文档走类型图标 + 名称/大小：

<DemoContainer>
  <AttachmentsMessageDemo />
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import type { Attachment } from '@toimc/core'
import {
  Message, MessageContent, MessageAttachments,
  Attachment, AttachmentPreview, AttachmentInfo,
} from '@toimc/vue'

const files: Attachment[] = [
  { id: 'att-1', name: '架构图.png', mediaType: 'image/png',
    size: 253952, url: 'https://example.com/arch.png' },
  { id: 'att-2', name: '调研报告.pdf', mediaType: 'application/pdf',
    size: 3355443 },
]
</script>

<template>
  <Message from="user">
    <!-- 附件在正文上方 -->
    <MessageAttachments>
      <Attachment v-for="f in files" :key="f.id" :data="f">
        <AttachmentPreview />
        <AttachmentInfo />
      </Attachment>
    </MessageAttachments>
    <MessageContent>帮我 review 这份材料</MessageContent>
  </Message>
</template>
```

</details>

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

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| content | `string` | — | 消息正文内容（传值后走 Markdown 渲染，不传走默认插槽） |
| thinking | `ThinkingInfo` | — | 思考过程信息，提供后显示折叠式思考块 |
| streaming | `boolean` | — | 是否正在流式更新（思考块仅在**思考自身进行中**（`thinking.active` 非 `false`）显示「正在思考…」，正文流式期间思考块保持收起；**正文为空时显示三点跳动指示**（发送→首 token 的空窗反馈），有正文时行尾由 MarkdownRenderer 挂**呼吸光标**） |

```typescript
interface ThinkingInfo {
  content: string   // 思考内容
  duration?: number // 思考耗时（毫秒），思考结束时由 useChat 自动计算
  startTime?: Date  // 思考开始时间
  active?: boolean  // 思考是否仍在进行：useChat 流式期间维护，首个正文/工具帧到达即置 false
}
```

### MessageAttachments

无 Props。附件项数据经 [`Attachment`](/components/attachments) 的 `data` 传入。

| 插槽名 | 说明 |
|--------|------|
| default | 附件项（Attachment 系列） |

### MessageActions

无 Props。默认 `opacity: 0`，父级 `.ai-chat-message` hover 时显示。

### MessageAction

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| label | `string` | — | 无障碍文本（不渲染视觉内容，作为 title 的兜底） |
| tooltip | `string` | — | 悬停提示，优先于 label 作为按钮 `title` |
| disabled | `boolean` | `false` | 禁用按钮 |

| 插槽名 | 说明 |
|--------|------|
| default | 按钮图标/内容 |

| 事件名 | 说明 |
|--------|------|
| click | 按钮点击 |
