<script setup lang="ts">
import { provide } from 'vue'
import type { Attachment } from '@ai-chat/core'

const props = defineProps<{
  data: Attachment
}>()

provide('attachmentData', props.data)
</script>

<template>
  <div class="ai-chat-attachment">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-attachment {
    position: relative;
  }
}
</style>
