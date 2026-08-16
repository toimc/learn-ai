<script setup lang="ts">
import { computed, inject } from 'vue'
import { aiChatI18n } from '../locales/index'
import { PROMPT_INPUT_KEY } from './context'

const { status, disabled } = inject(PROMPT_INPUT_KEY)!

const submit = inject<() => void>('promptSubmit')!
const abort = inject<() => void>('promptAbort')!

const { t } = aiChatI18n.global
const label = computed(() =>
  status.value === 'streaming' ? t('promptInput.stop') : t('promptInput.send'),
)
</script>

<template>
  <button
    class="ai-chat-prompt-submit"
    type="button"
    :aria-label="label"
    :disabled="disabled()"
    @click="status === 'streaming' ? abort() : submit()"
  >
    <slot>
      <svg
        v-if="status === 'ready'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor">
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      </svg>
    </slot>
  </button>
</template>

<!-- scoped：悬浮圆形按钮（主题色），不占布局空间；data-v 特异性可抵御
     宿主（如 VitePress base.css）未分层的 button 元素级 reset -->
<style scoped>
.ai-chat-prompt-submit {
  position: absolute;
  /* 右缘 14 与文字左内边距 14 对称；底 8 让单行时按钮垂直居中（行高 52 - 36）/2 */
  right: 14px;
  bottom: 8px;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--ai-chat-color-accent);
  color: var(--ai-chat-color-text-on-accent, #ffffff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-prompt-submit:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-hover);
}

.ai-chat-prompt-submit:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ai-chat-prompt-submit svg {
  width: 18px;
  height: 18px;
}
</style>
