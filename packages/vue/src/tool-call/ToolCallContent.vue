<script setup lang="ts">
import { inject } from 'vue'
import type { ToolCallInfo } from '@ai-chat/core'
import ToolCallInput from './ToolCallInput.vue'
import ToolCallOutput from './ToolCallOutput.vue'

const data = inject<ToolCallInfo>('toolCallData')!
</script>

<template>
  <div class="ai-chat-tool-call-content">
    <ToolCallInput />
    <ToolCallOutput v-if="data.result !== undefined || data.error" />
  </div>
</template>

<style>
.ai-chat-tool-call-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
