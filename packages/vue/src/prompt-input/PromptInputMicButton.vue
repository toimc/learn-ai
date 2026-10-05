<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { useSpeechInput } from '../composables/useSpeechInput'
import { aiChatI18n } from '../locales'
import { PROMPT_INPUT_KEY } from './context'

const props = withDefaults(defineProps<{ lang?: string }>(), {
  // BCP-47 识别语言，与 useSpeechInput 默认一致
  lang: 'zh-CN',
})

const emit = defineEmits<{
  /** 录音结束（点击停止或单句模式说完自动停）：最终识别文本已追加进输入框 */
  transcribed: [text: string]
}>()

const { inputText, disabled } = inject(PROMPT_INPUT_KEY)!

const { supported, isRecording, interimText, error, toggle } = useSpeechInput({
  lang: props.lang,
})

const { t } = aiChatI18n.global

const micLabel = computed(() =>
  isRecording.value ? t('promptInput.micStop') : t('promptInput.micStart'),
)

// composable 只存机器码，错误文案翻译归 UI 层；未知码原样展示便于排查
const ERROR_KEYS: Record<string, string> = {
  unsupported: 'speechErrors.unsupported',
  'no-speech': 'speechErrors.noSpeech',
  'not-allowed': 'speechErrors.notAllowed',
}
const errorText = computed(() => {
  const code = error.value
  if (!code) return ''
  const key = ERROR_KEYS[code]
  return key ? t(key) : code
})

// 录音结束（isRecording true→false）把最终识别文本追加进输入框：
// 语音识别不是 100% 准，落输入框供用户确认编辑再发送，而非直接发送
watch(isRecording, (rec, prev) => {
  if (prev && !rec) {
    const text = interimText.value.trim()
    if (!text) return
    inputText.value = inputText.value ? `${inputText.value} ${text}` : text
    emit('transcribed', text)
  }
})
</script>

<template>
  <!-- 特性检测驱动显隐：Firefox 等不支持时整颗按钮不出现 -->
  <div v-if="supported" class="ai-chat-prompt-mic">
    <button
      class="ai-chat-prompt-input-btn ai-chat-prompt-mic__btn"
      :class="{ 'ai-chat-prompt-mic__btn--recording': isRecording }"
      type="button"
      :title="micLabel"
      :aria-label="micLabel"
      :disabled="disabled()"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
    <!-- 实时字幕 / 错误反馈浮层：录音中或最近一次识别出错时出现 -->
    <div
      v-if="isRecording || errorText"
      class="ai-chat-prompt-mic__panel"
      role="status"
    >
      <p v-if="errorText" class="ai-chat-prompt-mic__error">
        {{ errorText }}
      </p>
      <p
        v-else
        class="ai-chat-prompt-mic__interim"
        :aria-label="t('promptInput.micStop')"
      >
        {{ interimText }}
      </p>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-mic {
    position: relative;
    display: inline-flex;
  }

  .ai-chat-prompt-mic__btn--recording {
    color: var(--ai-chat-color-accent);
    border-radius: var(--ai-chat-radius-md);
    animation: ai-chat-mic-pulse 1.6s var(--ai-chat-easing) infinite;
  }

  .ai-chat-prompt-mic__panel {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    max-width: 320px;
    padding: 6px 10px;
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-primary);
    border: 1px solid var(--ai-chat-color-border);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ai-chat-prompt-mic__interim,
  .ai-chat-prompt-mic__error {
    margin: 0;
    font-size: 13px;
    color: var(--ai-chat-color-text-secondary);
  }
}

@layer ai-chat-animations {
  /* 录音中脉冲动效：accent 色光环扩散，提示麦克风在采集 */
  @keyframes ai-chat-mic-pulse {
    0% {
      box-shadow: 0 0 0 0 var(--ai-chat-color-accent-dim);
    }
    70% {
      box-shadow: 0 0 0 6px transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }
}
</style>
