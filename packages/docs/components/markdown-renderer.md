# MarkdownRenderer

轻量 Markdown 渲染器，支持标题、加粗、斜体、行内代码和代码块。

> **公式为可选能力**：LaTeX 公式渲染所需的 KaTeX 样式不会自动注入，需手动 `import '@ai-chat/markdown/katex.css'`（详见[安装指南](/guide/installation)）。不引入时公式以纯文本呈现，其余功能不受影响。

## 基础用法

<DemoContainer>
  <MarkdownRenderer
    content="# 标题\n\n这是一段 **加粗** 和 _斜体_ 文字。\n\n行内代码：`const x = 1`\n\n```typescript\nfunction hello(name: string): string {\n  return `Hello, ${name}!`\n}\n```"
  />
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
