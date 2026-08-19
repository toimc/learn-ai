# Conversation 系列

对话容器组件，提供滚动管理和自动吸底功能。包含 4 个子组件：

- **Conversation** — 根容器，provide 滚动上下文与消息布局上下文
- **ConversationContent** — 可滚动消息区，max-width 768px 居中
- **ConversationEmpty** — 欢迎屏（空对话占位）
- **ConversationScrollBtn** — 回到底部浮动按钮

## 基础用法

`Conversation` 作为根容器包裹消息区与输入区，`ConversationContent` 负责滚动，空对话时用 `ConversationEmpty` 展示欢迎屏。

<DemoContainer>
  <div style="height: 320px; border-radius: 12px; overflow: hidden; border: 1px solid var(--vp-c-divider);">
    <Conversation>
      <ConversationContent>
        <ConversationEmpty>
          <div style="text-align: center; padding: 48px 24px;">
            <h3 style="margin-bottom: 8px;">欢迎使用 AI Chat UI</h3>
            <p style="color: var(--vp-c-text-2);">发送一条消息开始对话</p>
          </div>
        </ConversationEmpty>
      </ConversationContent>
    </Conversation>
  </div>
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<template>
  <Conversation>
    <ConversationContent>
      <ConversationEmpty v-if="messages.length === 0">
        <h3>欢迎使用 AI Chat UI</h3>
        <p>发送一条消息开始对话</p>
      </ConversationEmpty>

      <Message v-for="msg in messages" :key="msg.id" :from="msg.role">
        <MessageContent>{{ msg.content }}</MessageContent>
      </Message>
    </ConversationContent>
  </Conversation>
</template>
```

</details>

## 消息布局

`layout` 属性控制消息对齐模式，可实时切换体验两种布局的差异；`im` 模式下 `messageAlign` 决定用户消息停靠侧（AI 消息在对侧）。试试切换下方按钮：

- **stacked** — 所有消息统一靠左，适合阅读型长回复
- **im** — 用户与 AI 分列两侧，单条气泡限宽，适合即时问答

<DemoContainer>
  <ConversationLayoutDemo />
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  Conversation, ConversationContent, Message, MessageContent,
} from '@ai-chat/vue'

const layout = ref<'stacked' | 'im'>('stacked')
const messageAlign = ref<'left' | 'right'>('right')
</script>

<template>
  <!-- stacked：统一靠左；im：用户与 AI 分列两侧 -->
  <Conversation :layout="layout" :message-align="messageAlign">
    <ConversationContent>
      <Message from="user">
        <MessageContent>给我一句话解释什么是 Monorepo</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent
          content="Monorepo 是把多个包放进同一个代码仓库管理的工程模式。"
        />
      </Message>
    </ConversationContent>
  </Conversation>
</template>
```

</details>

## 消息角色

`Message` 的 `from` 属性区分三种角色样式：`user` 用户消息、`assistant` AI 消息、`system` 系统提示。AI 消息可通过 `MessageContent` 的 `thinking` 属性展示折叠式思考过程（点击「已思考 X 秒」展开），操作按钮 `MessageActions` 在 hover 时浮现：

<DemoContainer>
  <MessageShowcaseDemo />
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import type { ThinkingInfo } from '@ai-chat/core'
import {
  Message, MessageContent, MessageActions, MessageAction,
} from '@ai-chat/vue'

const thinking: ThinkingInfo = {
  content: '用户要一句话解释，压缩到核心痛点…',
  duration: 4210, // 思考耗时（毫秒），useChat 流式时自动计算
}

const message = {
  role: 'assistant',
  content: 'Composition API 让逻辑按**功能**聚合而不是按选项类型分散。',
}
</script>

<template>
  <Message :from="message.role">
    <!-- thinking 可选：提供即显示折叠式思考过程 -->
    <MessageContent :content="message.content" :thinking="thinking" />

    <!-- hover 消息时浮现 -->
    <MessageActions>
      <MessageAction title="复制"><!-- 复制图标 --></MessageAction>
      <MessageAction title="重新生成"><!-- 重新生成图标 --></MessageAction>
    </MessageActions>
  </Message>
</template>
```

</details>

## 滚动管理

`ConversationContent` 上监听 `scroll` 可检测是否位于底部（距底 50px 内视为吸底）；离开底部时显示 `ConversationScrollBtn`，点击回到底部。向上滚动下面的长列表试试：

<DemoContainer>
  <ConversationScrollDemo />
</DemoContainer>

<details>
<summary>查看源码</summary>

```vue
<script setup lang="ts">
import { ref, nextTick } from 'vue'
import {
  Conversation, ConversationContent, ConversationScrollBtn,
} from '@ai-chat/vue'

const scrollRef = ref<HTMLElement>()
const isAtBottom = ref(true)

function handleScroll() {
  const el = scrollRef.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}
</script>

<template>
  <Conversation>
    <ConversationContent ref="scrollRef" @scroll="handleScroll">
      <!-- 消息列表 -->
    </ConversationContent>

    <ConversationScrollBtn v-if="!isAtBottom" @click="scrollToBottom" />
  </Conversation>
</template>
```

</details>

## 与 useChat 组合

```vue
<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import {
  Conversation, ConversationContent, ConversationEmpty
} from '@ai-chat/vue'

const chat = useChat(adapter)
</script>

<template>
  <Conversation>
    <ConversationContent>
      <ConversationEmpty v-if="chat.messages.length === 0">
        <h3>有什么可以帮你的？</h3>
      </ConversationEmpty>

      <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
        <MessageContent>{{ msg.content }}</MessageContent>
      </Message>
    </ConversationContent>
  </Conversation>
</template>
```

## API

### Conversation

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| layout | `'stacked' \| 'im'` | `'stacked'` | 消息对齐模式：`stacked` 统一靠左（现状）；`im` 用户与 AI 分列两侧 |
| messageAlign | `'left' \| 'right'` | `'left'` | `im` 模式下用户消息停靠侧（AI 在对侧）；`stacked` 下不生效 |
| autoScroll | `boolean` | `true` | 新消息自动吸底 |
| theme | `PresetKey` | — | 内置预设名（`default` / `purple` / `green` / `warm`） |
| customTheme | `Record<string, string>` | — | 自定义 CSS 变量键值对象 |
| darkMode | `boolean \| 'auto'` | `'auto'` | 容器级明暗：`true` / `false` 强制，`'auto'` 跟随全局 |

通过 `provide` 把滚动上下文与消息布局上下文下发给子组件。

### ConversationContent

消息区默认 `max-width: var(--ai-chat-content-max-width)` 居中，四周留白 24px（底部留白用于与输入区隔开）；容器宽度 ≥ 1280px（xl 超大屏）时经容器查询自动放宽到 `--ai-chat-content-max-width-wide`（宽屏显示更宽的消息）。

| 插槽名 | 说明 |
|--------|------|
| default | 消息内容区域 |

### ConversationEmpty

| 插槽名 | 说明 |
|--------|------|
| default | 空状态内容（欢迎屏） |

### ConversationScrollBtn

| 事件名 | 说明 |
|--------|------|
| click | 用户点击回到底部按钮 |
