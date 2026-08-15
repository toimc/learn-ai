<script setup lang="ts">
import { computed, getCurrentInstance, inject, ref } from 'vue'
import type { Attachment } from '@ai-chat/core'
import { ImageLightbox } from '../preview'
import { PROMPT_INPUT_KEY } from './context'
import { formatFileSize } from '../utils/format'
import { getMediaCategory } from '../utils/media'
import type { PendingFile } from '../composables/usePendingFiles'

const { pendingFiles, remove } = inject(PROMPT_INPUT_KEY)!

const attrs = getCurrentInstance()?.vnode.props
const emit = defineEmits<{
  preview: [{ attachments: Attachment[]; index: number }]
}>()

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

function isImage(p: PendingFile) {
  return p.file.type.startsWith('image/') && !!p.previewUrl
}

const imageAttachments = computed<Attachment[]>(() =>
  pendingFiles.value.filter(isImage).map((p) => ({
    id: p.id,
    name: p.file.name,
    mediaType: p.file.type,
    url: p.previewUrl,
    size: p.file.size,
  })),
)

const hostHandlesPreview = computed(() => !!attrs && 'onPreview' in attrs)

function openPreview(p: PendingFile) {
  if (!isImage(p)) return
  const index = Math.max(
    0,
    imageAttachments.value.findIndex((a) => a.id === p.id),
  )
  if (hostHandlesPreview.value) {
    emit('preview', { attachments: imageAttachments.value, index })
    return
  }
  lightboxIndex.value = index
  lightboxOpen.value = true
}

const ICONS: Record<string, string> = {
  document: '📄',
  audio: '🎵',
  video: '🎬',
}

function iconFor(mime: string) {
  const category = getMediaCategory(mime)
  return ICONS[category] || '📎'
}
</script>

<template>
  <div v-if="pendingFiles.length" class="ai-chat-prompt-attachments">
    <div
      v-for="p in pendingFiles"
      :key="p.id"
      class="ai-chat-prompt-attachments__item"
      :class="{
        'ai-chat-prompt-attachments__item--uploading': p.status === 'uploading',
        'ai-chat-prompt-attachments__item--error': p.status === 'error',
      }"
      :title="p.error || p.file.name"
    >
      <button
        type="button"
        class="ai-chat-prompt-attachments__thumb"
        :aria-label="`预览 ${p.file.name}`"
        @click="openPreview(p)"
      >
        <img v-if="isImage(p)" :src="p.previewUrl" :alt="p.file.name" />
        <span
          v-else
          class="ai-chat-prompt-attachments__icon"
          aria-hidden="true"
          >{{ iconFor(p.file.type) }}</span
        >
        <span
          v-if="p.status === 'uploading'"
          class="ai-chat-prompt-attachments__loading"
        />
      </button>
      <div class="ai-chat-prompt-attachments__meta">
        <span class="ai-chat-prompt-attachments__name">{{ p.file.name }}</span>
        <span class="ai-chat-prompt-attachments__size">{{
          formatFileSize(p.file.size)
        }}</span>
      </div>
      <button
        type="button"
        class="ai-chat-prompt-attachments__remove"
        aria-label="移除附件"
        @click="remove(p.id)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <ImageLightbox
      v-if="lightboxOpen"
      :attachments="imageAttachments"
      :index="lightboxIndex"
      @close="lightboxOpen = false"
    />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 12px 0;
  }

  .ai-chat-prompt-attachments__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    background: var(--ai-chat-color-bg-secondary);
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-prompt-attachments__item:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-prompt-attachments__item--error {
    border-color: var(--ai-chat-color-status-error);
  }

  .ai-chat-prompt-attachments__thumb {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: var(--ai-chat-radius-md);
    background: transparent;
    cursor: pointer;
    overflow: hidden;
  }

  .ai-chat-prompt-attachments__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ai-chat-prompt-attachments__icon {
    font-size: 18px;
    line-height: 1;
  }

  .ai-chat-prompt-attachments__loading {
    position: absolute;
    inset: 0;
    background: var(--ai-chat-hover-neutral);
    animation: ai-chat-pending-pulse var(--ai-chat-duration-normal) ease-in-out
      infinite alternate;
  }

  .ai-chat-prompt-attachments__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    max-width: 160px;
  }

  .ai-chat-prompt-attachments__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ai-chat-color-text-primary);
    font-size: 13px;
    line-height: 1.3;
  }

  .ai-chat-prompt-attachments__size {
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
    line-height: 1.2;
  }

  .ai-chat-prompt-attachments__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--ai-chat-color-text-muted);
    cursor: pointer;
    transition:
      background var(--ai-chat-duration-fast) var(--ai-chat-easing),
      color var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-prompt-attachments__remove:hover {
    background: var(--ai-chat-hover-neutral);
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-prompt-attachments__remove svg {
    width: 14px;
    height: 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-prompt-attachments__loading {
      animation: none;
    }
  }
}

@layer ai-chat-animations {
  @keyframes ai-chat-pending-pulse {
    from {
      opacity: 0.4;
    }
    to {
      opacity: 0.9;
    }
  }
}
</style>
