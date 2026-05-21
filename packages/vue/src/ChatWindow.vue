<script setup lang="ts">
defineProps<{
  height?: string
}>()
</script>

<template>
  <div class="ai-chat-window" :style="{ height: height || '100%' }">
    <div class="ai-chat-window__body">
      <slot />
    </div>
    <div class="ai-chat-window__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style>
.ai-chat-window {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ai-chat-border-color, #e5e7eb);
  border-radius: var(--ai-chat-radius, 8px);
  overflow: hidden;
  background: var(--ai-chat-bg, #ffffff);
}

.ai-chat-window__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--ai-chat-padding, 16px);
}

.ai-chat-window__footer {
  border-top: 1px solid var(--ai-chat-border-color, #e5e7eb);
  padding: var(--ai-chat-padding, 16px);
}
</style>
