<script setup lang="ts">
defineProps<{
  formula: string
  display?: boolean
}>()
</script>

<template>
  <span
    class="ai-chat-latex"
    :class="{ 'ai-chat-latex--display': display }"
  >
    {{ formula }}
  </span>
</template>

<style>
.ai-chat-latex {
  font-family: 'Cambria Math', 'Latin Modern Math', serif;
  font-style: italic;
}

.ai-chat-latex--display {
  display: block;
  text-align: center;
  margin: 12px 0;
  font-size: 1.1em;
}
</style>
