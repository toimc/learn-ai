<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

const rendered = computed(() => {
  return simpleMarkdown(props.content)
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function simpleMarkdown(text: string): string {
  // 先把代码块提取为占位符，避免后续全局换行替换（\n → <br>）穿透进 <pre>
  // 造成代码块行距双倍的问题。用 Unicode 私用区字符 U+E000 作占位边界，
  // 正常 Markdown 文本不会出现该字符。
  const codeBlocks: string[] = []
  let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(
      `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`,
    )
    return `${codeBlocks.length - 1}`
  })

  html = escapeHtml(html)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\n/g, '<br>')

  return html.replace(/(\d+)/g, (_, i) => codeBlocks[Number(i)]!)
}
</script>

<template>
  <div class="ai-chat-markdown" v-html="rendered" />
</template>

<style>
.ai-chat-markdown {
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
}

.ai-chat-markdown pre {
  background: var(--ai-chat-code-bg, #1e1e2e);
  color: var(--ai-chat-code-color, #cdd6f4);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.ai-chat-markdown code {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.ai-chat-markdown :not(pre) > code {
  background: var(--ai-chat-inline-code-bg, #f1f5f9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.ai-chat-markdown h1,
.ai-chat-markdown h2,
.ai-chat-markdown h3 {
  margin: 12px 0 6px;
}

.ai-chat-markdown strong {
  font-weight: 600;
}
</style>
