<script setup lang="ts">
import type { Message } from '@toimc/core'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div class="ai-chat-bubble" :class="[`ai-chat-bubble--${message.role}`]">
    <div class="ai-chat-bubble__avatar">
      <slot name="avatar" />
    </div>
    <div class="ai-chat-bubble__content">
      <slot />
    </div>
    <div class="ai-chat-bubble__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-bubble {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .ai-chat-bubble--user {
    flex-direction: row-reverse;
  }

  .ai-chat-bubble__avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
  }

  .ai-chat-bubble__content {
    flex: 1;
    padding: 10px 14px;
    border-radius: var(--ai-chat-bubble-radius, 12px);
    font-size: 14px;
    line-height: 1.6;
  }

  .ai-chat-bubble--user .ai-chat-bubble__content {
    background: var(--ai-chat-user-bg, #2563eb);
    color: var(--ai-chat-user-color, #ffffff);
  }

  .ai-chat-bubble--assistant .ai-chat-bubble__content {
    background: var(--ai-chat-assistant-bg, #f3f4f6);
    color: var(--ai-chat-assistant-color, #1f2937);
  }

  .ai-chat-bubble__actions {
    flex-shrink: 0;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .ai-chat-bubble:hover .ai-chat-bubble__actions {
    opacity: 1;
  }
}
</style>
