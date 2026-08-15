<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment } from '@ai-chat/core'
import {
  aiChatI18n,
  PromptInput,
  PromptInputAttachments,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputTools,
  PromptInputUploadButton,
} from '@ai-chat/vue'

import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

interface SendPayload {
  text: string
  attachments?: Attachment[]
  files?: File[]
}

const lastPayload = ref<SendPayload | null>(null)

async function mockUpload(files: File[]): Promise<Attachment[]> {
  await new Promise((r) => setTimeout(r, 800))
  return files.map((f) => ({
    id: `att_${f.name}_${f.size}`,
    name: f.name,
    mediaType: f.type || 'application/octet-stream',
    size: f.size,
    url: URL.createObjectURL(f),
  }))
}

function onSend(payload: SendPayload) {
  lastPayload.value = payload
}

function formatBytes(bytes?: number) {
  if (!bytes) return undefined
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <section class="pg-demo-card">
    <header class="pg-demo-card__header">
      <h3 class="pg-demo-card__title">{{ t('pg.multimodalDemo.title') }}</h3>
      <p class="pg-demo-card__desc">{{ t('pg.multimodalDemo.description') }}</p>
    </header>

    <PromptInput
      :before-send="mockUpload"
      :max-size="10 * 1024 * 1024"
      :max-files="5"
      @send="onSend"
    >
      <PromptInputAttachments />
      <PromptInputTextarea :placeholder="t('pg.input.placeholder')" />
      <PromptInputSubmit />
      <template #footer>
        <PromptInputFooter>
          <template #tools>
            <PromptInputTools>
              <PromptInputUploadButton kind="image" />
              <PromptInputUploadButton kind="file" />
            </PromptInputTools>
          </template>
          <template #hint>
            <span class="pg-demo-card__hint">{{ t('pg.input.hint') }}</span>
          </template>
        </PromptInputFooter>
      </template>
    </PromptInput>

    <div class="pg-demo-card__payload">
      <div class="pg-demo-card__payload-head">
        <span>{{ t('pg.multimodalDemo.payloadTitle') }}</span>
        <button
          v-if="lastPayload"
          class="pg-demo-card__reset"
          type="button"
          @click="lastPayload = null"
        >
          {{ t('pg.multimodalDemo.reset') }}
        </button>
      </div>
      <pre v-if="lastPayload" class="pg-demo-card__payload-body">{{
        JSON.stringify(
          {
            text: lastPayload.text,
            attachments: lastPayload.attachments?.map((a) => ({
              name: a.name,
              mediaType: a.mediaType,
              size: formatBytes(a.size),
            })),
            files: lastPayload.files?.map((f) => ({
              name: f.name,
              size: f.size,
            })),
          },
          null,
          2,
        )
      }}</pre>
      <p v-else class="pg-demo-card__payload-empty">
        {{ t('pg.multimodalDemo.payloadEmpty') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.pg-demo-card {
  max-width: var(--ai-chat-content-max-width, 768px);
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.pg-demo-card__header {
  margin-bottom: 16px;
}

.pg-demo-card__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--ai-chat-color-text-primary);
}

.pg-demo-card__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ai-chat-color-text-secondary);
}

.pg-demo-card__hint {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

.pg-demo-card__payload {
  margin-top: 16px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-lg);
  background: var(--ai-chat-color-bg-secondary);
  overflow: hidden;
}

.pg-demo-card__payload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-chat-color-border);
  font-size: 13px;
  font-weight: 500;
  color: var(--ai-chat-color-text-secondary);
}

.pg-demo-card__reset {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.pg-demo-card__reset:hover {
  background: var(--ai-chat-hover-neutral);
}

.pg-demo-card__payload-body {
  margin: 0;
  padding: 14px;
  max-height: 260px;
  overflow: auto;
  font-family: var(--ai-chat-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ai-chat-color-text-primary);
}

.pg-demo-card__payload-empty {
  margin: 0;
  padding: 14px;
  font-size: 13px;
  color: var(--ai-chat-color-text-muted);
}
</style>
