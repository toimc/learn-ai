# MarkdownRenderer

轻量 Markdown 渲染器，支持标题、加粗、斜体、行内代码和代码块。

> **公式为可选能力**：LaTeX 公式渲染所需的 KaTeX 样式不会自动注入，需手动 `import '@toimc/markdown/katex.css'`（详见[安装指南](/guide/installation)）。不引入时公式以纯文本呈现，其余功能不受影响。

## 公式容错（LLM 畸形输出防护）

渲染前内置 `guardMathBlocks` 预处理，应对 LLM 常见的四类畸形公式输出（流式场景管线为 `extractCompleteMarkdown` 流式完整性提取 → 公式容错 → markdown-it 渲染）：

| 畸形形态 | 处理方式 |
|--------|---------|
| 多行 `$$` 块紧贴正文（无空行分隔），被段落吸收撕碎 | 重新聚合：前后插空行隔离为独立公式块，行尾起块的前缀文字拆为独立段落 |
| 公式体内单独成行的 `---` / `===` 被 Setext 误判为 `<h2>` / `<h1>` | 随块隔离整块进入公式规则消费，不再触发标题解析 |
| 行内 `$` 与货币金额误配为公式（如 `费用 $100，补贴$五十元`） | 上下文启发式排除：`$` 紧邻数字且后随 CJK/全角标点/行尾等货币边界时转义为字面量 |
| 未闭合 `$$`（LLM 忘写闭合符） | 在所在段落末尾补齐闭合符，空行后的正文不受牵连 |

已规范的公式输入（单行 `$$..$$`、行内 `$..$`、前后空行的多行块）原样通过，不受扰动；代码块（```` ``` ```` / `~~~`）内的内容一律不改。

局限：引用块与列表项内的多行公式不做块隔离（避免破坏宿主结构，交由行内公式规则处理）；公式体内含 `$` 字符、行内代码中的货币 `$` 属极端场景，不在启发式覆盖范围内。

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
| streaming | `boolean` | — | 流式更新中：容器带 `is-streaming` 类，行尾挂**呼吸光标**（柔和 opacity 渐变，主流 AI 聊天形态），结束时随类移除消失 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-code-bg | `#1e1e2e` | 代码块背景 |
| --ai-chat-code-color | `#cdd6f4` | 代码块文字 |
| --ai-chat-inline-code-bg | `#f1f5f9` | 行内代码背景 |
