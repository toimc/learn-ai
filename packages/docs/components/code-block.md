# CodeBlock

独立代码块组件，带可选的语言标签头部、行号与长代码折叠。

## 基础用法

<DemoContainer>
  <CodeBlock language="typescript" code="interface ChatAdapter {
  sendMessage(options: SendMessageOptions): AsyncGenerator<StreamChunk>
}" />
</DemoContainer>

## 无语言标签

不传 `language` 时隐藏语言标签（头部仍承载复制按钮）：

<DemoContainer>
  <CodeBlock code="console.log('Hello World')" />
</DemoContainer>

## 显示行号

`showLineNumbers` 开启逐行渲染，行号列在横向滚动时固定于左侧：

<DemoContainer>
  <CodeBlock
    language="typescript"
    show-line-numbers
    code="const a = 1
const b = 2
const c = a + b
console.log(c)"
  />
</DemoContainer>

## 折叠长代码

`collapsibleAfter` 指定阈值行数：实际行数超过它时初始只显示前 N 行，
底部提供「展开 / 收起」按钮；`0`（默认）表示不折叠。流式输出期间
（`streaming` 为 `true`）折叠被禁用——尾部行尚未定稿：

<DemoContainer>
  <CodeBlock
    language="typescript"
    :collapsible-after="3"
    code="function fibonacci(n: number): number[] {
  const seq = [0, 1]
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2])
  }
  return seq.slice(0, n)
}
console.log(fibonacci(10))"
  />
</DemoContainer>

行号与折叠可同时启用。

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| code | `string` | — | 代码内容（必填） |
| language | `string` | — | 语言标签（不传则隐藏语言标签，头部仍渲染） |
| streaming | `boolean` | — | 是否仍在流式输出；`true` 时合并 unstable token 让尾行可见，且禁用折叠 |
| showLineNumbers | `boolean` | `false` | 显示行号（逐行渲染，行号在横向滚动时固定左侧） |
| collapsibleAfter | `number` | `0` | 超过该行数时折叠显示前 N 行并提供展开/收起按钮；`0` = 不折叠 |

### 文案国际化

折叠按钮文案（展开 / 收起）复用 `@toimc/vue` 的 `aiChatI18n` 字典
（markdown 包自身无独立字典），key 为 `codeBlock.expand` / `codeBlock.collapse`。
宿主切换语言或注入自定义文案的方式与其它组件一致
（`setAiChatLocale` / `setLocaleMessage`）。

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-color-code-bg | 主题令牌 | 代码区域背景（行号列同色） |
| --ai-chat-color-code-header-bg | 主题令牌 | 头部背景 |
