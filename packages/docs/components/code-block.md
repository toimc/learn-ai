# CodeBlock

独立代码块组件，带可选的语言标签头部。

## 基础用法

<DemoContainer>
  <CodeBlock language="typescript" code="interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
}" />
</DemoContainer>

## 无语言标签

不传 `language` 时隐藏头部：

<DemoContainer>
  <CodeBlock code="console.log('Hello World')" />
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| code | `string` | — | 代码内容（必填） |
| language | `string` | — | 语言标签（不传则隐藏头部） |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-code-header-bg | `#2d2d3f` | 头部背景 |
| --ai-chat-code-bg | `#1e1e2e` | 代码区域背景 |
| --ai-chat-code-color | `#cdd6f4` | 代码文字颜色 |
