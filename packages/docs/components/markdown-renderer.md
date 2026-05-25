# MarkdownRenderer

轻量 Markdown 渲染器，支持标题、加粗、斜体、行内代码和代码块。

## 基础用法

<DemoContainer>
  <MarkdownRenderer content="# 标题

这是一段 **加粗** 和 _斜体_ 文字。

行内代码：`const x = 1`

```typescript
function hello(name: string): string {
  return `Hello, ${name}!`
}
```
" />
</DemoContainer>

## 在消息中使用

通常与 `MessageBubble` 配合使用：

```vue
<MessageBubble :message="message">
  <MarkdownRenderer :content="message.content" />
</MessageBubble>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| content | `string` | — | Markdown 文本内容（必填） |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-code-bg | `#1e1e2e` | 代码块背景 |
| --ai-chat-code-color | `#cdd6f4` | 代码块文字 |
| --ai-chat-inline-code-bg | `#f1f5f9` | 行内代码背景 |
