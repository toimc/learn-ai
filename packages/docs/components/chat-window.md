# ChatWindow

聊天窗口布局容器，提供可滚动的消息区域和固定底部区域。

## 基础用法

<DemoContainer>
  <ChatWindow style="height: 320px">
    <p style="padding: 16px; color: #666">消息内容区域（可滚动）</p>
    <template #footer>
      <div style="padding: 12px; border-top: 1px solid #e5e7eb; color: #666">底部输入区域</div>
    </template>
  </ChatWindow>
</DemoContainer>

## 自定义高度

通过 `height` prop 设置窗口高度：

```vue
<ChatWindow height="500px">
  <!-- ... -->
</ChatWindow>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| height | `string` | `'100%'` | 窗口高度（CSS 值） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 消息内容区域（可滚动） |
| footer | 底部区域，通常放置 InputArea |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-border-color | `#e5e7eb` | 边框颜色 |
| --ai-chat-radius | `8px` | 圆角大小 |
| --ai-chat-bg | `#ffffff` | 背景颜色 |
| --ai-chat-padding | `16px` | 内边距 |
