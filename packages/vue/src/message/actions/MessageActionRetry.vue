<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../../locales'
import MessageAction from '../MessageAction.vue'

const { t } = aiChatI18n.global

interface Props {
  /** 禁用（如流式进行中不可重试） */
  disabled?: boolean
}

withDefaults(defineProps<Props>(), { disabled: false })

const emit = defineEmits<{ retry: [] }>()

const tooltip = computed(() => t('messageActions.retry'))
</script>

<template>
  <MessageAction :tooltip="tooltip" :disabled="disabled" @click="emit('retry')">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  </MessageAction>
</template>
