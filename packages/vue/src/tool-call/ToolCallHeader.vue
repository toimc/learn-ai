<script setup lang="ts">
import { inject, computed } from 'vue'
import type { ToolCallInfo } from '@ai-chat/core'
import { formatDuration } from '../utils/format'

const data = inject<ToolCallInfo>('toolCallData')!

const statusIcon = computed(() => {
  switch (data.status) {
    case 'calling':
      return '⚡'
    case 'completed':
      return '✓'
    case 'error':
      return '✗'
    default:
      return '⚡'
  }
})

const statusClass = computed(() => `ai-chat-tool-call-header--${data.status}`)
</script>

<template>
  <span class="ai-chat-tool-call-header" :class="[statusClass]">
    <span class="ai-chat-tool-call-header__icon">{{ statusIcon }}</span>
    <span class="ai-chat-tool-call-header__name">{{ data.name }}</span>
    <span v-if="data.duration" class="ai-chat-tool-call-header__duration">
      {{ formatDuration(data.duration) }}
    </span>
  </span>
</template>

<style>
.ai-chat-tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-chat-tool-call-header__icon {
  font-size: 12px;
  font-style: normal;
}

.ai-chat-tool-call-header--calling .ai-chat-tool-call-header__icon {
  color: var(--ai-chat-color-status-warning, #f59e0b);
}

.ai-chat-tool-call-header--completed .ai-chat-tool-call-header__icon {
  color: var(--ai-chat-color-status-success, #22c55e);
}

.ai-chat-tool-call-header--error .ai-chat-tool-call-header__icon {
  color: var(--ai-chat-color-status-error, #ef4444);
}

.ai-chat-tool-call-header__name {
  font-weight: 500;
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-tool-call-header__duration {
  color: var(--ai-chat-color-text-muted);
  font-size: 12px;
  margin-left: auto;
}
</style>
