<script setup lang="ts">
import { inject } from 'vue'
import type { Attachment } from '@ai-chat/core'
import { getMediaCategory } from '../utils/media'

const data = inject<Attachment>('attachmentData')!

const category = getMediaCategory(data.mediaType)

const iconMap: Record<string, string> = {
  document: '📄',
  audio: '🎵',
  video: '🎬',
}
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
    />
    <span v-else class="ai-chat-attachment-preview__icon">
      {{ iconMap[category] || '📄' }}
    </span>
  </div>
</template>

<style>
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
}

.ai-chat-attachment-preview__icon {
  font-size: 28px;
}
</style>
