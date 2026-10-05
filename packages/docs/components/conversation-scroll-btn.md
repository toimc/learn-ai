# ConversationScrollBtn

回到底部浮动按钮。必须放在 `Conversation` 内使用——它通过 inject 读取 `useScrollAnchor` 提供的滚动上下文：用户滚离底部时按钮可见，点击后平滑回到底部；离底期间有新内容时按钮右上角显示**未读角标**。

## 代码演示

<script setup lang="ts">
import { onMounted, provide, ref, watch } from 'vue'
import { Button, ConversationScrollBtn, useScrollAnchor } from '@toimc/vue'

// Conversation 内部即这段装配：useScrollAnchor + provide('scrollAnchor')
const anchor = useScrollAnchor()
provide('scrollAnchor', anchor)

const lines = ref(Array.from({ length: 12 }, (_, i) => `消息 ${i + 1}：对话进行中……`))

// 未读计数由宿主维护（见下方「未读角标语义」）：badge prop 显式传入
const unread = ref(0)
watch(anchor.isAtBottom, (atBottom) => {
  if (atBottom) unread.value = 0
})

onMounted(() => anchor.scrollToBottom())

function addMessage() {
  if (!anchor.isAtBottom.value) unread.value++
  lines.value.push(`消息 ${lines.value.length + 1}：新消息到达`)
}
</script>

先把容器滚动条向上拖离底部，再点「追加一条消息」——右下角浮现回到底部按钮并显示未读角标；点击按钮回到底部并清零：

<DemoContainer>
  <div
    :ref="anchor.bindContainer"
    style="
      position: relative;
      height: 200px;
      overflow-y: auto;
      padding: 12px 16px;
      border: 1px solid var(--ai-chat-color-border);
      border-radius: 8px;
      background: var(--ai-chat-color-bg-primary);
    "
  >
    <p v-for="(line, i) in lines" :key="i" style="margin: 0 0 10px; font-size: 13px">
      {{ line }}
    </p>
    <ConversationScrollBtn :badge="unread" />
  </div>
  <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center">
    <Button type="secondary" size="small" @click="addMessage">追加一条消息</Button>
    <span style="font-size: 12px; color: var(--ai-chat-color-text-muted)">
      离底追加计未读，回底自动清零（计数由宿主经 badge prop 传入）
    </span>
  </div>
</DemoContainer>

## 基础用法

```vue
<Conversation>
  <ConversationContent>
    <!-- 消息列表 -->
  </ConversationContent>
  <ConversationScrollBtn />
</Conversation>
```

按钮绝对定位于容器右下角，贴底时以 `visibility: hidden` 隐藏（保留布局不跳动）。

## Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `badge` | `number` | — | 未读角标数字。缺省读取 inject 的 `unreadCount`；显式传 `0` 可强制隐藏角标（覆盖上下文中的非零值） |

## 未读角标语义

角标数字来自 `useScrollAnchor` 的 `unreadCount`，其语义是**容器内容高度的增加次数**：

- 用户离底期间，滚动容器内容每增高一次，计数 +1（贴底时恒为 0，跟随滚动不计数）。
- 点击按钮（`scrollToBottom`）或用户手动滚回贴底，计数清零。
- 角标出现时按钮带 `aria-label`，文案走 i18n `conversation.scrollUnread`（默认 `{count} 条新消息` / `{count} new messages`）。
- 内容变化检测为双通道：`ResizeObserver`（容器自身尺寸变化）+ `MutationObserver`（子树节点/文本变化）。后者是必需兜底——浏览器对 overflow 定高滚动容器的内容增高**不派发容器 ResizeObserver**，仅靠 RO 时计数在生产环境永不增长。高频变化经 rAF 合并，每帧只做一次高度对比。

> **语义局限**：「新消息」以内容高度增加近似，无法区分真正的消息新增与已有消息的流式文本追加——流式回复期间离底，计数会随内容增高持续上涨。需要精确按消息条数计数时，通过 `badge` prop 自行传入。

## 与 useScrollAnchor 的关系

`Conversation` 内部调用 `useScrollAnchor()` 并 provide 为 `scrollAnchor`；本组件是同一上下文的消费者。宿主也可直接从 `@toimc/vue` 导入 `useScrollAnchor` 自行组装滚动控制，上下文接口为：`isAtBottom` / `unreadCount` / `scrollToBottom()` / `bindContainer()`。

## 相关

- [Conversation 系列](/components/conversation)：容器、消息区、空态与本组件的组装方式。
- [useClipboard](/composables/use-clipboard)：复制反馈 composable。
