<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChat, isImageFile } from '@toimc/core'
import type { Attachment, Message as ChatMessage } from '@toimc/core'
import {
  aiChatI18n,
  compressImageToDataUrl,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  Message,
  MessageAttachments,
  MessageContent,
  PromptInput,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputTools,
  PromptInputUploadButton,
} from '@toimc/vue'
import { createSseAdapter } from '../../mock/sse-adapter'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 真发送链路：dev-server 在线时走 SSE（mock 剧本模式忽略图片照常回文本）
const chat = useChat(createSseAdapter())

const chatAreaRef = ref<HTMLElement>()

function scrollToBottom() {
  nextTick(() => {
    if (chatAreaRef.value) {
      chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
    }
  })
}

watch(() => chat.messages.length, scrollToBottom)

// 压缩产物 dataUrl 同时承担预览（url）与发送（dataUrl）：
// 不经 createObjectURL，预览地址无失效窗口，也零 blob 生命周期管理成本
async function beforeSend(files: File[]): Promise<Attachment[]> {
  const results: Attachment[] = []
  for (const f of files) {
    if (isImageFile(f)) {
      const dataUrl = await compressImageToDataUrl(f)
      results.push({
        id: `att_${f.name}_${f.size}`,
        name: f.name,
        mediaType: f.type,
        size: f.size,
        url: dataUrl,
        dataUrl,
      })
    } else {
      results.push({
        id: `att_${f.name}_${f.size}`,
        name: f.name,
        mediaType: f.type || 'application/octet-stream',
        size: f.size,
      })
    }
  }
  return results
}

/** 最近一次发送的线协议形状（教学展示：parts 组装结果） */
const lastWire = ref<ChatMessage[] | null>(null)

function onSend(payload: { text: string; attachments?: Attachment[] }) {
  lastWire.value = [
    {
      id: 'preview',
      role: 'user',
      content: payload.text,
      attachments: payload.attachments,
      createdAt: new Date(),
    },
  ]
  void chat.send(payload.text, payload.attachments)
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

    <Conversation>
      <ConversationContent ref="chatAreaRef">
        <ConversationEmpty v-if="chat.messages.length === 0">
          <p class="pg-demo-card__payload-empty">
            {{ t('pg.multimodalDemo.payloadEmpty') }}
          </p>
        </ConversationEmpty>
        <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
          <MessageAttachments v-if="msg.attachments?.length">
            <img
              v-for="att in msg.attachments"
              :key="att.id"
              class="pg-multimodal-thumb"
              :src="att.url"
              :alt="att.name"
            />
          </MessageAttachments>
          <MessageContent
            :content="msg.content"
            :streaming="chat.isStreaming"
          />
        </Message>
      </ConversationContent>

      <PromptInput
        send-key="enter"
        :before-send="beforeSend"
        :max-size="10 * 1024 * 1024"
        :max-files="5"
        @send="onSend"
      >
        <PromptInputAttachments />
        <PromptInputBody>
          <PromptInputTextarea :placeholder="t('pg.input.placeholder')" />
        </PromptInputBody>
        <template #footer>
          <PromptInputFooter>
            <template #tools>
              <PromptInputTools>
                <PromptInputUploadButton kind="image" />
                <PromptInputUploadButton kind="file" />
              </PromptInputTools>
            </template>
            <template #hint>
              <PromptInputSubmit />
            </template>
          </PromptInputFooter>
        </template>
      </PromptInput>
    </Conversation>

    <div v-if="chat.error" class="pg-multimodal-error" role="alert">
      {{ chat.error.message }}
    </div>

    <div class="pg-demo-card__payload">
      <div class="pg-demo-card__payload-head">
        <span>{{ t('pg.multimodalDemo.payloadTitle') }}</span>
        <button
          v-if="lastWire"
          class="pg-demo-card__reset"
          type="button"
          @click="lastWire = null"
        >
          {{ t('pg.multimodalDemo.reset') }}
        </button>
      </div>
      <pre v-if="lastWire" class="pg-demo-card__payload-body">{{
        JSON.stringify(
          {
            text: lastWire[0]?.content,
            attachments: lastWire[0]?.attachments?.map((a) => ({
              name: a.name,
              mediaType: a.mediaType,
              size: formatBytes(a.size),
              hasDataUrl: Boolean(a.dataUrl),
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
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.pg-multimodal-thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: var(--ai-chat-radius-md);
  border: 1px solid var(--ai-chat-color-border);
}

.pg-multimodal-error {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-hover-neutral);
  font-size: 13px;
  line-height: 1.6;
  color: var(--ai-chat-color-text-secondary);
}
</style>
