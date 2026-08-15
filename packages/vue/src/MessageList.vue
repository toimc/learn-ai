<script setup lang="ts">
import type { Message } from '@ai-chat/core'

defineProps<{
  messages: Message[]
}>()
</script>

<template>
  <div class="ai-chat-message-list">
    <div
      v-for="message in messages"
      :key="message.id"
      class="ai-chat-message-list__item"
    >
      <slot :message="message" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-message-list {
    display: flex;
    flex-direction: column;
    gap: var(--ai-chat-message-gap, 12px);
  }
}
</style>
