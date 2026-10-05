<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../../locales'
import { useSpeechOutput } from '../../composables/useSpeechOutput'
import MessageAction from '../MessageAction.vue'

interface Props {
  /** 待朗读文本（通常传 message.content） */
  text: string
  /** 未朗读时的提示文案，默认 i18n messageActions.speak */
  tooltip?: string
  /** 朗读中的提示文案，默认 i18n messageActions.stopSpeak */
  speakingTooltip?: string
}

const props = defineProps<Props>()

const { speaking, speak, stop } = useSpeechOutput()

const { t } = aiChatI18n.global

const tooltip = computed(() =>
  speaking.value
    ? (props.speakingTooltip ?? t('messageActions.stopSpeak'))
    : (props.tooltip ?? t('messageActions.speak')),
)

/** 点击切换：朗读中打断，否则整段朗读（speak 内部先打断旧朗读） */
function handleClick() {
  if (speaking.value) stop()
  else speak(props.text)
}
</script>

<template>
  <MessageAction :tooltip="tooltip" @click="handleClick">
    <!-- 朗读中：喇叭加斜线（点击停止） -->
    <svg
      v-if="speaking"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
    <!-- 待朗读：带声波的喇叭 -->
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  </MessageAction>
</template>
