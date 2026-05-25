<template>
  <div v-if="$slots.default" class="ai-chat-prompt-input-header">
    <slot />
  </div>
</template>

<style>
.ai-chat-prompt-input-header {
  padding: 8px 12px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
