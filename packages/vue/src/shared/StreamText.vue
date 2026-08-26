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
@layer ai-chat-components {
  .ai-chat-stream-text__cursor {
    /* 柔和呼吸替代硬闪烁，与 MarkdownRenderer 流式光标同一节奏 */
    animation: ai-chat-caret-breathe 1.1s ease-in-out infinite;
  }

  @keyframes ai-chat-caret-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
}
</style>
