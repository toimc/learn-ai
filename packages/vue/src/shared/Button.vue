<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
defineProps<{
  type?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="ai-chat-btn"
    :class="[
      type ? `ai-chat-btn--${type}` : 'ai-chat-btn--primary',
      size ? `ai-chat-btn--${size}` : 'ai-chat-btn--medium',
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style>
.ai-chat-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: var(--ai-chat-btn-radius, 6px);
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s,
    opacity 0.2s;
}

.ai-chat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* sizes */
.ai-chat-btn--small {
  padding: 4px 10px;
  font-size: 12px;
}

.ai-chat-btn--medium {
  padding: 6px 16px;
  font-size: 14px;
}

.ai-chat-btn--large {
  padding: 10px 22px;
  font-size: 16px;
}

/* types */
.ai-chat-btn--primary {
  background: var(--ai-chat-btn-primary-bg, #2563eb);
  color: var(--ai-chat-btn-primary-color, #ffffff);
}

.ai-chat-btn--primary:hover:not(:disabled) {
  background: var(--ai-chat-btn-primary-hover-bg, #1d4ed8);
}

.ai-chat-btn--secondary {
  background: var(--ai-chat-btn-secondary-bg, #f3f4f6);
  color: var(--ai-chat-btn-secondary-color, #1f2937);
}

.ai-chat-btn--secondary:hover:not(:disabled) {
  background: var(--ai-chat-btn-secondary-hover-bg, #e5e7eb);
}

.ai-chat-btn--danger {
  background: var(--ai-chat-btn-danger-bg, #dc2626);
  color: var(--ai-chat-btn-danger-color, #ffffff);
}

.ai-chat-btn--danger:hover:not(:disabled) {
  background: var(--ai-chat-btn-danger-hover-bg, #b91c1c);
}
</style>
