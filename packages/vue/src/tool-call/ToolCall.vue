<script setup lang="ts">
import { provide, ref } from 'vue'
import type { ToolCallInfo } from '@toimc/core'
import ToolCallHeader from './ToolCallHeader.vue'
import ToolCallContent from './ToolCallContent.vue'

const props = defineProps<{
  data: ToolCallInfo
}>()

provide('toolCallData', props.data)

const isOpen = ref(false)
</script>

<template>
  <details
    class="ai-chat-tool-call"
    :open="isOpen"
    @toggle="(e: Event) => (isOpen = (e.target as HTMLDetailsElement).open)"
  >
    <summary class="ai-chat-tool-call__summary">
      <slot name="header" :data="data" :open="isOpen">
        <ToolCallHeader />
      </slot>
    </summary>
    <div class="ai-chat-tool-call__body">
      <slot :data="data">
        <ToolCallContent />
      </slot>
    </div>
  </details>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-tool-call {
    margin: 8px 0;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    overflow: hidden;
    font-size: 13px;
  }

  .ai-chat-tool-call__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    background: var(--ai-chat-color-bg-secondary);
    list-style: none;
    user-select: none;
  }

  .ai-chat-tool-call__summary::-webkit-details-marker {
    display: none;
  }

  .ai-chat-tool-call__summary::before {
    content: '▶';
    font-size: 10px;
    transition: transform var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-tool-call[open] .ai-chat-tool-call__summary::before {
    transform: rotate(90deg);
  }

  .ai-chat-tool-call__body {
    padding: 12px;
    border-top: 1px solid var(--ai-chat-color-border);
    background: var(--ai-chat-color-bg-primary);
  }
}
</style>
