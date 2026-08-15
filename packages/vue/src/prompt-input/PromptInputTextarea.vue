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

<!-- scoped 而非 @layer：宿主文档站（VitePress 等）的未分层元素级 reset
     （如 textarea { padding: 0 }）会压过任何 @layer 规则；data-v 属性
     选择器天然限本组件不泄漏，且特异性高于元素级 reset -->
<style scoped>
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
  /* 输入行弹性高度：随内容增长，超过上限后内部滚动（类 ChatGPT/豆包） */
  max-height: var(--ai-chat-input-max-height, 200px);
  min-height: 24px;
  line-height: 1.5;
  overflow-y: auto;
}

.ai-chat-prompt-textarea::placeholder {
  color: var(--ai-chat-color-text-muted);
}
</style>
