<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'grid' | 'inline' | 'list'
  }>(),
  { variant: 'grid' },
)
</script>

<template>
  <div class="ai-chat-attachments" :class="[`ai-chat-attachments--${variant}`]">
    <slot />
  </div>
</template>

<style>
.ai-chat-attachments--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.ai-chat-attachments--inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chat-attachments--list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
