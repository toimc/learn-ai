<script setup lang="ts">
import { useMarkdownRenderer } from '../composables/useMarkdownRenderer'

const props = defineProps<{ content?: string }>()
const renderer = useMarkdownRenderer()
</script>

<template>
  <div class="ai-chat-message-content">
    <component
      :is="renderer"
      v-if="renderer && props.content !== undefined"
      :content="props.content"
    />
    <slot v-else />
  </div>
</template>

<style>
.ai-chat-message-content {
  font-size: 15px;
  line-height: 1.7;
  color: var(--ai-chat-color-text-primary);
  word-wrap: break-word;
}

.ai-chat-message-content p {
  margin-bottom: 12px;
}

.ai-chat-message-content p:last-child {
  margin-bottom: 0;
}

.ai-chat-message-content code {
  background: var(--ai-chat-code-inline-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13.5px;
  font-family: var(--ai-chat-font-mono);
}

.ai-chat-message-content pre {
  background: var(--ai-chat-code-bg);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 12px 0;
  overflow-x: auto;
  border: 1px solid var(--ai-chat-color-border);
}

.ai-chat-message-content pre code {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
}

.ai-chat-message-content ul,
.ai-chat-message-content ol {
  padding-left: 20px;
  margin: 8px 0;
}

.ai-chat-message-content li {
  margin: 4px 0;
}

.ai-chat-message-content strong {
  font-weight: 600;
}
</style>
