# useScrollAnchor

会话容器的滚动锚定 composable：维护「是否贴底 / 未读计数 / 回到底部」三件事，让长对话在流式输出时自动跟随、用户上翻阅读时不被打扰。

## 适用场景

| 场景 | 说明 |
|------|------|
| 流式输出自动跟随 | 贴底时内容高度增长（新 token / 新消息）自动滚到最新，实现「打字机跟随」 |
| 上翻阅读不打扰 | 用户拖离底部后停止自动滚动，期间新增内容累计未读角标 |
| 回到底部按钮 | `isAtBottom` 驱动按钮显隐，`unreadCount` 驱动角标，点击调用 `scrollToBottom()` 并清零 |
| 自定义会话容器 | 不用 Conversation 时，任意 `overflow-y: auto` 容器接上 `bindContainer` 即可获得同款锚定行为 |

**典型消费组件**（provide / inject 关系）：

- [Conversation](/components/conversation) —— 内部 `useScrollAnchor()` 并 `provide('scrollAnchor', anchor)`，是上下文的唯一提供方
- [ConversationScrollBtn](/components/conversation-scroll-btn) —— `inject('scrollAnchor')` 消费：按钮显隐、未读角标、点击回底全部来自本 composable 的状态

## 代码演示

<script setup lang="ts">
import { onMounted, provide, ref, watch } from 'vue'
import { Button, useScrollAnchor } from '@toimc/vue'

const anchor = useScrollAnchor()
provide('scrollAnchor', anchor)

const lines = ref(Array.from({ length: 10 }, (_, i) => `消息 ${i + 1}`))

// 宿主自行维护的未读计数（见「行为」一节的说明）
const unread = ref(0)
watch(anchor.isAtBottom, (atBottom) => {
  if (atBottom) unread.value = 0
})

onMounted(() => anchor.scrollToBottom())

function addMessage() {
  if (!anchor.isAtBottom.value) unread.value++
  lines.value.push(`消息 ${lines.value.length + 1}`)
}
</script>

拖动容器滚离底部后追加消息，观察 `isAtBottom` 翻转与宿主侧未读计数：

<DemoContainer>
  <div
    :ref="anchor.bindContainer"
    style="
      position: relative;
      height: 160px;
      overflow-y: auto;
      padding: 10px 14px;
      border: 1px solid var(--ai-chat-color-border);
      border-radius: 8px;
      background: var(--ai-chat-color-bg-primary);
    "
  >
    <p v-for="(line, i) in lines" :key="i" style="margin: 0 0 8px; font-size: 13px">
      {{ line }}
    </p>
  </div>
  <p
    style="
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--ai-chat-color-text-muted);
    "
  >
    isAtBottom: {{ anchor.isAtBottom.value }} · 未读（宿主维护）: {{ unread }}
    <Button
      type="secondary"
      size="small"
      style="margin-left: 8px"
      @click="addMessage"
    >
      追加消息
    </Button>
  </p>
</DemoContainer>

## 函数签名

```typescript
function useScrollAnchor(threshold?: number): ScrollAnchorContext

interface ScrollAnchorContext {
  isAtBottom: Ref<boolean>
  /** 离底期间容器内容新增导致的未读计数（贴底时恒为 0） */
  unreadCount: Ref<number>
  scrollToBottom: () => void
  bindContainer: (el: HTMLElement | null) => void
}
```

## 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `threshold` | `number` | `50` | 距底部小于该像素值即视为「贴底」 |

## 行为

- 贴底判定基于 `scrollHeight - scrollTop - clientHeight < threshold`，滚动监听为 passive。
- 内容高度增长通过 `ResizeObserver` 观察：贴底时自动 `scrollToBottom`，离底且增长时 `unreadCount++`（无法区分「新增消息」与「文本替换」，语义局限）。
- `bindContainer` 会解绑旧容器并重设未读基线，容器卸载时传 `null` 清理 observer。

::: warning 未读计数的浏览器局限
`ResizeObserver` 观察的是**容器自身**的盒子尺寸。定高（或被 flex / grid 约束高度）的滚动容器在内容增高时盒子尺寸不变，浏览器不会派发 Resize 回调——此场景下 `unreadCount` 不增长，组件测试因 mock 了 ResizeObserver 也无法覆盖该行为。精确按消息条数计数时，请像上面演示那样由宿主自行维护计数，经 [ConversationScrollBtn](/components/conversation-scroll-btn) 的 `badge` prop 传入。
:::

## 相关

- [Conversation](/components/conversation)（提供方）
- [ConversationScrollBtn](/components/conversation-scroll-btn)（消费方）
