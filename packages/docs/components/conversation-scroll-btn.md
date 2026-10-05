# ConversationScrollBtn

回到底部浮动按钮。必须放在 `Conversation` 内使用——它通过 inject 读取 `useScrollAnchor` 提供的滚动上下文：用户滚离底部时按钮可见，点击后平滑回到底部；离底期间有新内容时按钮右上角显示**未读角标**。

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

> **语义局限**：「新消息」以内容高度增加近似，无法区分真正的消息新增与已有消息的流式文本追加——流式回复期间离底，计数会随内容增高持续上涨。需要精确按消息条数计数时，通过 `badge` prop 自行传入。

## 与 useScrollAnchor 的关系

`Conversation` 内部调用 `useScrollAnchor()` 并 provide 为 `scrollAnchor`；本组件是同一上下文的消费者。宿主也可直接从 `@toimc/vue` 导入 `useScrollAnchor` 自行组装滚动控制，上下文接口为：`isAtBottom` / `unreadCount` / `scrollToBottom()` / `bindContainer()`。

## 相关

- [Conversation 系列](/components/conversation)：容器、消息区、空态与本组件的组装方式。
- [useClipboard](/composables/use-clipboard)：复制反馈 composable。
