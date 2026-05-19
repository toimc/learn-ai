<script setup lang="ts">
defineProps<{
  code: string
  language?: string
}>()
</script>

<template>
  <div class="ai-chat-code-block">
    <div
      v-if="language"
      class="ai-chat-code-block__header"
    >
      {{ language }}
    </div>
    <pre class="ai-chat-code-block__pre"><code>{{ code }}</code></pre>
  </div>
</template>

<style>
.ai-chat-code-block {
  border-radius: 6px;
  overflow: hidden;
  margin: 8px 0;
}

.ai-chat-code-block__header {
  padding: 4px 12px;
  font-size: 12px;
  color: #9ca3af;
  background: var(--ai-chat-code-header-bg, #2d2d3f);
  text-transform: uppercase;
}

.ai-chat-code-block__pre {
  margin: 0;
  padding: 12px 16px;
  background: var(--ai-chat-code-bg, #1e1e2e);
  color: var(--ai-chat-code-color, #cdd6f4);
  overflow-x: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>
