<script setup lang="ts">
import { inject, type Ref } from 'vue'

const { inputText, disabled, maxHeight, placeholder } = inject<{
  inputText: Ref<string>
  disabled: () => boolean
  maxHeight: () => number
  placeholder: () => string
}>('promptInput')!

const submit = inject<() => void>('promptSubmit')!

function handleInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  inputText.value = el.value
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, maxHeight()) + 'px'
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <textarea
    :value="inputText"
    class="ai-chat-prompt-textarea"
    :placeholder="placeholder()"
    :disabled="disabled()"
    rows="1"
    @input="handleInput"
    @keydown="handleKeydown"
  />
</template>

<style>
.ai-chat-prompt-textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--ai-chat-color-text-primary);
  font-size: 15px;
  font-family: var(--ai-chat-font-sans);
  padding: 14px 16px 14px 20px;
  resize: none;
  outline: none;
  max-height: 200px;
  min-height: 24px;
  line-height: 1.5;
}

.ai-chat-prompt-textarea::placeholder {
  color: var(--ai-chat-color-text-muted);
}
</style>
