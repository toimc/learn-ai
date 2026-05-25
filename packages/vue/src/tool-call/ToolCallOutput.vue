<script setup lang="ts">
import { inject } from 'vue'
import type { ToolCallInfo } from '@ai-chat/core'

const data = inject<ToolCallInfo>('toolCallData')!
</script>

<template>
  <div class="ai-chat-tool-call-output">
    <template v-if="data.error">
      <div
        class="ai-chat-tool-call-output__label ai-chat-tool-call-output__label--error"
      >
        Error
      </div>
      <pre
        class="ai-chat-tool-call-output__code ai-chat-tool-call-output__code--error"
        >{{ data.error }}</pre
      >
    </template>
    <template v-else>
      <div class="ai-chat-tool-call-output__label">Result</div>
      <pre class="ai-chat-tool-call-output__code">{{
        JSON.stringify(data.result, null, 2)
      }}</pre>
    </template>
  </div>
</template>

<style>
.ai-chat-tool-call-output__label {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
  margin-bottom: 4px;
}

.ai-chat-tool-call-output__label--error {
  color: var(--ai-chat-color-status-error, #ef4444);
}

.ai-chat-tool-call-output__code {
  margin: 0;
  padding: 8px;
  background: var(--ai-chat-color-bg-secondary);
  border-radius: var(--ai-chat-radius-md, 6px);
  border: 1px solid var(--ai-chat-color-border);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  color: var(--ai-chat-color-text-primary);
  font-family: var(--ai-chat-font-mono);
}

.ai-chat-tool-call-output__code--error {
  border-color: var(--ai-chat-color-status-error, #ef4444);
  background: rgba(239, 68, 68, 0.08);
}
</style>
