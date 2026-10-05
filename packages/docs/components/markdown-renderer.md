# MarkdownRenderer

轻量 Markdown 渲染器，支持标题、加粗、斜体、行内代码和代码块。

> **公式为可选能力**：LaTeX 公式渲染所需的 KaTeX 样式不会自动注入，需手动 `import '@toimc/markdown/katex.css'`（详见[安装指南](/guide/installation)）。不引入时公式以纯文本呈现，其余功能不受影响。

## 代码演示

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { MarkdownRenderer } from '@toimc/markdown'

const demoContent = [
  '## 调参记录',
  '',
  '| 参数 | 旧值 | 新值 |',
  '| ---- | ---- | ---- |',
  '| model | gpt-4o | glm-4.7 |',
  '| temperature | 0.7 | 0.3 |',
  '',
  '在 **精度** 与 _成本_ 之间取平衡，采样温度设为 $T = 0.3$：',
  '',
  '$$',
  '\\mathcal{L}(\\theta) = \\sum_{i=1}^{n} \\ell(f_\\theta(x_i), y_i)',
  '$$',
  '',
  '对应调用代码（Shiki 高亮）：',
  '',
  '```ts',
  'const params = { model: "glm-4.7", temperature: 0.3 }',
  'await client.chat(params)',
  '```',
].join('\n')

const streamChunks = [
  '先给结论：流式期间行尾挂呼吸光标，文字 **逐段** 到达；',
  '未闭合的代码围栏会被流式完整性提取挂起，',
  '围栏补齐的瞬间整块渲染：',
  '\n\n```ts\nconst answer = 42\n```\n\n以上就是流式全流程。',
]

const streamText = ref('')
const isStreaming = ref(false)
let streamTimer: ReturnType<typeof setInterval> | null = null
let done = ''
let pending = ''

function stopStream() {
  if (streamTimer) clearInterval(streamTimer)
  streamTimer = null
  isStreaming.value = false
}

function playStream() {
  stopStream()
  done = ''
  pending = streamChunks.join('')
  streamText.value = ''
  isStreaming.value = true
  streamTimer = setInterval(() => {
    if (!pending) {
      stopStream()
      return
    }
    done += pending[0]
    pending = pending.slice(1)
    streamText.value = done
  }, 24)
}

onBeforeUnmount(stopStream)
</script>

### 完成态渲染

一次成型：表格、行内 / 块级公式、代码块（Shiki 高亮）随完整 Markdown 串一起渲染。Best for：消息生成结束后的静态展示、历史消息回放。

<DemoContainer>
  <MarkdownRenderer :content="demoContent" />
</DemoContainer>

### 流式输出

`streaming` 为 `true` 时容器挂 `is-streaming` 类，行尾出现呼吸光标；结束时随类移除消失。Best for：AI 回复逐字到达的实时渲染。

点击按钮观察（代码块在围栏闭合前不渲染，闭合瞬间整块出现）：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 8px">
      <button
        :disabled="isStreaming"
        style="
          padding: 4px 14px;
          font-size: 13px;
          cursor: pointer;
          border: 1px solid var(--ai-chat-color-border);
          border-radius: var(--ai-chat-radius-md);
          background: var(--ai-chat-color-bg);
        "
        @click="playStream"
      >
        模拟流式输出
      </button>
      <button
        v-if="isStreaming"
        style="
          padding: 4px 14px;
          font-size: 13px;
          cursor: pointer;
          border: 1px solid var(--ai-chat-color-border);
          border-radius: var(--ai-chat-radius-md);
          background: var(--ai-chat-color-bg);
        "
        @click="stopStream"
      >
        停止
      </button>
    </div>
    <MarkdownRenderer :content="streamText" :streaming="isStreaming" />
    <p
      v-if="!streamText && !isStreaming"
      style="margin: 0; font-size: 13px; color: var(--ai-chat-color-text-muted)"
    >
      （尚未开始输出）
    </p>
  </div>
</DemoContainer>

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

```vue
<script setup lang="ts">
import { MarkdownRenderer } from '@toimc/markdown'

const content = '# 标题\n\n这是一段 **加粗** 和 _斜体_ 文字。\n\n行内代码：`const x = 1`'
</script>

<template>
  <MarkdownRenderer :content="content" />
</template>
```

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
