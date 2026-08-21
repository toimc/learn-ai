<script setup lang="ts">
import { inject } from 'vue'
import type { Attachment } from '@toimc/core'
import { getMediaCategory, getFileIcon } from '../utils/media'

const data = inject<Attachment>('attachmentData')!

const emit = defineEmits<{
  preview: []
}>()

const category = getMediaCategory(data.mediaType)
</script>

<template>
  <div
    class="ai-chat-attachment-preview"
    :class="[`ai-chat-attachment-preview--${category}`]"
  >
    <img
      v-if="category === 'image' && data.url"
      :src="data.url"
      :alt="data.name"
      class="ai-chat-attachment-preview__img"
      @click="emit('preview')"
    />
    <span v-else class="ai-chat-attachment-preview__icon">
      {{ getFileIcon(data.mediaType) }}
    </span>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-attachment-preview {
    width: 96px;
    height: 96px;
    border-radius: var(--ai-chat-radius-lg);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ai-chat-color-bg-secondary);
    border: 1px solid var(--ai-chat-color-border);
  }

  .ai-chat-attachment-preview__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
  }

  .ai-chat-attachment-preview__icon {
    font-size: 28px;
  }
}
</style>
