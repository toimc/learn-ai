<script setup lang="ts">
import { inject } from 'vue'
import type { ToolCallInfo } from '@ai-chat/core'

const data = inject<ToolCallInfo>('toolCallData')!
</script>

<template>
  <div class="ai-chat-tool-call-input">
    <div class="ai-chat-tool-call-input__label">Parameters</div>
    <pre class="ai-chat-tool-call-input__code">{{
      JSON.stringify(data.arguments, null, 2)
    }}</pre>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-tool-call-input__label {
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
    margin-bottom: 4px;
  }

  .ai-chat-tool-call-input__code {
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
}
</style>
