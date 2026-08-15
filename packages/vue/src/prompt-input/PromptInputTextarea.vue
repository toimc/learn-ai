<script setup lang="ts">
import { inject } from 'vue'
import { PROMPT_INPUT_KEY } from './context'

const { inputText, disabled, maxHeight, placeholder, sendKey, addFiles } =
  inject(PROMPT_INPUT_KEY)!

const submit = inject<() => void>('promptSubmit')!

function handleInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  inputText.value = el.value
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, maxHeight()) + 'px'
}

function handleKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return // IME 组合中，交给输入法
  if (e.key !== 'Enter') return
  if (sendKey() === 'enter') {
    if (!e.shiftKey) {
      e.preventDefault()
      submit()
    }
    return
  }
  // alt-enter 模式：Enter 原生换行不拦截；Alt/Cmd+Enter 发送
  if ((e.altKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function handlePaste(e: ClipboardEvent) {
  const files = e.clipboardData?.files
  if (files && files.length > 0) {
    e.preventDefault()
    addFiles(files)
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
    @paste="handlePaste"
  />
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-textarea {
    flex: 1;
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--ai-chat-color-text-primary);
    font-size: 15px;
    font-family: var(--ai-chat-font-sans);
    padding: 14px 16px 14px 20px;
    resize: none;
    outline: none;
    max-height: var(--ai-chat-input-max-height, 200px);
    min-height: 24px;
    line-height: 1.5;
  }

  .ai-chat-prompt-textarea::placeholder {
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
