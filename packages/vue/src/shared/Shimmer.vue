<script setup lang="ts">
withDefaults(defineProps<{ as?: string; duration?: number }>(), {
  as: 'span',
  duration: 2000,
})
</script>

<template>
  <component
    :is="as"
    class="ai-chat-shimmer"
    :style="{ animationDuration: duration + 'ms' }"
  >
    <slot />
  </component>
</template>
