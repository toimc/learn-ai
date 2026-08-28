<script setup lang="ts">
/**
 * @deprecated 已废弃，请迁移到 PromptInput 复合组件
 * （支持附件上传/粘贴/拖拽、Enter 换行 Alt/Cmd+Enter 发送等能力）。
 * 保留导出仅为向后兼容，后续大版本移除。
 */
import { ref } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [content: string]
  abort: []
}>()

const input = ref('')

function handleSubmit() {
  const text = input.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  input.value = ''
}

function handleAbort() {
  emit('abort')
}
</script>

<template>
  <div class="ai-chat-input">
    <slot name="prepend" />
    <div class="ai-chat-input__row">
      <textarea
        v-model="input"
        class="ai-chat-input__textarea"
        :placeholder="placeholder || t('inputArea.placeholder')"
        :disabled="disabled"
        rows="1"
        @keydown.enter.exact.prevent="handleSubmit"
      />
      <button
        v-if="disabled"
        class="ai-chat-input__btn ai-chat-input__btn--abort"
        @click="handleAbort"
      >
        {{ t('inputArea.stop') }}
      </button>
      <button
        v-else
        class="ai-chat-input__btn"
        :disabled="!input.trim()"
        @click="handleSubmit"
      >
        {{ t('inputArea.send') }}
      </button>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-input__row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .ai-chat-input__textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--ai-chat-color-border, #e5e7eb);
    border-radius: var(--ai-chat-radius, 8px);
    padding: 8px 12px;
    font-size: 14px;
    line-height: 1.5;
    font-family: inherit;
    outline: none;
    background: var(--ai-chat-color-input-bg, #ffffff);
    color: var(--ai-chat-input-color, #1f2937);
  }

  .ai-chat-input__textarea:focus {
    border-color: var(--ai-chat-primary, #2563eb);
  }

  .ai-chat-input__btn {
    padding: 8px 16px;
    border: none;
    border-radius: var(--ai-chat-radius, 8px);
    background: var(--ai-chat-primary, #2563eb);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
  }

  .ai-chat-input__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ai-chat-input__btn--abort {
    background: var(--ai-chat-danger, #ef4444);
  }
}
</style>
