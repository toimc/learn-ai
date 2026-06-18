<script setup lang="ts">
import { watchEffect } from 'vue'
import { useStreamingMarkdown } from './composables/useStreamingMarkdown'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const { html, setContent, flush } = useStreamingMarkdown()

watchEffect(() => {
  setContent(props.content)
})
watchEffect(() => {
  if (!props.streaming) flush()
})
</script>

<template>
  <div class="ai-chat-markdown" v-html="html" />
</template>

<style>
.ai-chat-markdown {
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
}

.ai-chat-markdown :deep(h1),
.ai-chat-markdown :deep(h2),
.ai-chat-markdown :deep(h3) {
  margin: 16px 0 8px;
}

.ai-chat-markdown :deep(pre) {
  background: var(--ai-chat-code-bg, #1e1e2e);
  color: var(--ai-chat-code-color, #cdd6f4);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.ai-chat-markdown :deep(code) {
  font-family: var(
    --ai-chat-font-mono,
    'Menlo',
    'Monaco',
    'Courier New',
    monospace
  );
  font-size: 13px;
}

.ai-chat-markdown :deep(:not(pre) > code) {
  background: var(--ai-chat-inline-code-bg, #f1f5f9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.ai-chat-markdown :deep(strong) {
  font-weight: 600;
}
</style>
