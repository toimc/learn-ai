<script setup lang="ts">
import { ref, provide } from 'vue'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
    maxHeight?: number
    accept?: string
    multiple?: boolean
    maxFiles?: number
  }>(),
  {
    disabled: false,
    placeholder: '给 AI Chat UI 发送消息...',
    maxHeight: 200,
    accept: '',
    multiple: false,
    maxFiles: 5,
  },
)

const emit = defineEmits<{
  send: [payload: { text: string; files?: File[] }]
  abort: []
}>()

const inputText = ref('')
const files = ref<File[]>([])
const status = ref<'ready' | 'streaming'>('ready')

provide('promptInput', {
  inputText,
  files,
  status,
  disabled: () => props.disabled,
  maxHeight: () => props.maxHeight,
  placeholder: () => props.placeholder,
})

function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || props.disabled) return
  emit('send', { text, files: files.value.length ? files.value : undefined })
  inputText.value = ''
  files.value = []
}

function handleAbort() {
  emit('abort')
}

provide('promptSubmit', handleSubmit)
provide('promptAbort', handleAbort)
</script>

<template>
  <div class="ai-chat-prompt-input">
    <div class="ai-chat-prompt-input__wrapper">
      <slot />
    </div>
    <p class="ai-chat-prompt-input__disclaimer">
      <slot name="disclaimer"
        >AI Chat UI 可能会产生不准确的信息，请注意甄别内容的准确性</slot
      >
    </p>
  </div>
</template>

<style>
.ai-chat-prompt-input {
  max-width: var(--ai-chat-content-max-width);
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 20px;
}

.ai-chat-prompt-input__wrapper {
  position: relative;
  background: var(--ai-chat-input-bg);
  border-radius: var(--ai-chat-radius-xl);
  border: 1px solid var(--ai-chat-input-border);
  transition:
    border-color var(--ai-chat-duration-normal) var(--ai-chat-easing),
    box-shadow var(--ai-chat-duration-normal) var(--ai-chat-easing);
}

.ai-chat-prompt-input__wrapper:focus-within {
  border-color: var(--ai-chat-input-focus-border);
  box-shadow: 0 0 0 2px var(--ai-chat-color-accent-dim);
}

.ai-chat-prompt-input__disclaimer {
  text-align: center;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
  padding: 8px 24px 0;
}
</style>
