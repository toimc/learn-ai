<script setup lang="ts">
import { inject, type Ref } from 'vue'

const { status, disabled } = inject<{
  status: Ref<'ready' | 'streaming'>
  disabled: () => boolean
}>('promptInput')!

const submit = inject<() => void>('promptSubmit')!
const abort = inject<() => void>('promptAbort')!
</script>

<template>
  <button
    class="ai-chat-prompt-submit"
    :disabled="disabled()"
    @click="status === 'streaming' ? abort() : submit()"
  >
    <svg v-if="status === 'ready'" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404z"
      />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  </button>
</template>

<style>
.ai-chat-prompt-submit {
  width: 36px;
  height: 36px;
  margin: 6px 8px;
  border-radius: 10px;
  border: none;
  background: var(--ai-chat-color-input-bg);
  color: var(--ai-chat-color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
  flex-shrink: 0;
}

.ai-chat-prompt-submit:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ai-chat-prompt-submit:not(:disabled):hover {
  background: var(--ai-chat-hover-neutral);
}

.ai-chat-prompt-submit svg {
  width: 18px;
  height: 18px;
}
</style>
