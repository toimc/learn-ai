<script setup lang="ts">
import { inject } from 'vue'
import type { Attachment } from '@ai-chat/core'
import { getAttachmentLabel } from '../utils/media'
import { formatFileSize } from '../utils/format'

const data = inject<Attachment>('attachmentData')!
</script>

<template>
  <div class="ai-chat-attachment-info">
    <span class="ai-chat-attachment-info__name">{{ data.name }}</span>
    <span class="ai-chat-attachment-info__meta">
      {{ getAttachmentLabel(data.mediaType) }}
      <template v-if="data.size"> · {{ formatFileSize(data.size) }}</template>
    </span>
  </div>
</template>

<style>
.ai-chat-attachment-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ai-chat-attachment-info__name {
  font-size: 13px;
  color: var(--ai-chat-color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-attachment-info__meta {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}
</style>
