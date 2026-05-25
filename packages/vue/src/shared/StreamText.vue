<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  stream?: string
}>()

const displayText = ref('')
const cursorVisible = ref(true)

watch(
  () => props.stream,
  (val) => {
    if (val !== undefined) {
      displayText.value = val
      cursorVisible.value = true
    }
  },
)

watch(
  () => props.stream,
  (val) => {
    if (val === undefined) {
      cursorVisible.value = false
    }
  },
)
</script>

<template>
  <span class="ai-chat-stream-text">
    {{ displayText }}
    <span v-if="cursorVisible" class="ai-chat-stream-text__cursor"
      >&#x2589;</span
    >
  </span>
</template>

<style>
.ai-chat-stream-text__cursor {
  animation: ai-chat-blink 1s step-end infinite;
}

@keyframes ai-chat-blink {
  50% {
    opacity: 0;
  }
}
</style>
