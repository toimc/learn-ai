<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { copyText } from '@toimc/core'
import { aiChatI18n } from '../../locales'
import MessageAction from '../MessageAction.vue'

const { t } = aiChatI18n.global

interface Props {
  /** 待复制文本 */
  text: string
  /** 按钮提示文案，默认 i18n messageActions.copy */
  tooltip?: string
}

const props = defineProps<Props>()

/** 复制成功回显 2s 后回退 */
const COPIED_RESET_MS = 2000

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const tooltip = computed(() => props.tooltip ?? t('messageActions.copy'))

async function handleCopy() {
  if (copied.value) return
  let ok: boolean
  try {
    ok = await copyText(props.text)
  } catch {
    // copyText 契约上不抛异常，此处兜底防御（如宿主环境异常）
    ok = false
  }
  if (!ok) return
  copied.value = true
  resetTimer = setTimeout(() => {
    copied.value = false
  }, COPIED_RESET_MS)
}

onUnmounted(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<template>
  <MessageAction :tooltip="tooltip" @click="handleCopy">
    <svg
      v-if="copied"
      class="ai-chat-message-action-copy__icon-check"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
    <svg
      v-else
      class="ai-chat-message-action-copy__icon-copy"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  </MessageAction>
</template>
